import { expect, test, type Page } from '@playwright/test';

const BBC = 'BBC News';

async function openTv(page: Page) {
	await page.goto('/');
	await expect(page.getByText('on the dial')).toBeVisible();
}

async function selectedVideoId(page: Page): Promise<string> {
	return page.evaluate(() => {
		const fake = (window as unknown as { __cableTvFake?: { getVideoId(): string } }).__cableTvFake;
		return fake?.getVideoId() ?? '';
	});
}

test('starter lineup, channel switching, number tuning and persistence', async ({ page }) => {
	await openTv(page);
	await expect(page.getByText('12 on the dial')).toBeVisible();
	await expect(page.getByTestId('lineup-count')).toContainText('12 in lineup');

	const linus = page
		.locator('nav[aria-label="Channel lineup"]')
		.getByRole('button', { name: /Linus Tech Tips/ });
	await linus.click();
	await expect(page).toHaveTitle(/Linus Tech Tips/);
	await expect(page).toHaveURL(/ch=UCXuqSBlHAE6Xw-yeJA0Tunw/);

	await page.keyboard.type('07');
	await page.keyboard.press('Enter');
	await expect(page).toHaveTitle(new RegExp(BBC));

	await page.reload();
	await expect(page.getByText('on the dial')).toBeVisible();
	await expect(page).toHaveTitle(new RegExp(BBC));
});

test('lineup add, remove, search and pack merge', async ({ page }) => {
	await page.goto('/lineup/');
	await expect(page.getByText('48 channels shown')).toBeVisible();

	const verge = page.locator('article').filter({ hasText: 'The Verge' }).first();
	await verge.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByTestId('lineup-count')).toContainText('13 in lineup');
	await verge.getByRole('button', { name: 'Selected', exact: true }).click();
	await expect(page.getByTestId('lineup-count')).toContainText('12 in lineup');

	const search = page.getByRole('searchbox', { name: 'Search channels' });
	await search.fill('space');
	await expect(page.getByText('2 channels shown')).toBeVisible();
	await search.fill('');

	const science = page.locator('article').filter({ hasText: 'Science & Discovery' }).first();
	await science.getByRole('button', { name: 'Preview' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByRole('button', { name: 'Merge pack' }).click();
	await expect(page.getByTestId('lineup-count')).toContainText('15 in lineup');
});

test('new developer, comedy and adventure packs merge into the lineup', async ({ page }) => {
	await page.goto('/lineup/');
	await expect(page.getByText('Developer TV')).toBeVisible();
	await expect(page.getByText('Comedy TV')).toBeVisible();
	await expect(page.getByText('Adventure TV')).toBeVisible();

	await page.getByRole('button', { name: 'Comedy', exact: true }).click();
	await expect(page.getByText('6 channels shown')).toBeVisible();
	await expect(page.getByText('Hasna Mana Hai')).toBeVisible();
	await expect(page.getByText('Ducky Bhai')).toBeVisible();

	const comedy = page.locator('article').filter({ hasText: 'Comedy TV' }).first();
	await comedy.getByRole('button', { name: 'Preview' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByRole('button', { name: 'Merge pack' }).click();
	await expect(page.getByTestId('lineup-count')).toContainText('18 in lineup');
});

test('favorites and reorder persist', async ({ page }) => {
	await page.goto('/lineup/');
	const firstRow = page.locator('aside ol li').first();
	const firstName = await firstRow.locator('p').first().innerText();
	await firstRow.getByRole('button', { name: 'Toggle favorite' }).click();
	await expect(firstRow.getByRole('button', { name: 'Toggle favorite' })).toHaveClass(
		/text-yellow/
	);

	const secondRow = page.locator('aside ol li').nth(1);
	const secondName = await secondRow.locator('p').first().innerText();
	await secondRow.getByRole('button', { name: 'Move up' }).click();

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Build your lineup' })).toBeVisible();
	const firstAfter = await page.locator('aside ol li').first().locator('p').first().innerText();
	expect(firstAfter).toBe(secondName);
	expect(firstAfter).not.toBe(firstName);
});

test('profile export, import and invalid catalog rejection', async ({ page }) => {
	await page.goto('/import-export/');
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export', exact: true }).first().click();
	const download = await downloadPromise;
	const path = await download.path();
	expect(download.suggestedFilename()).toMatch(/^cable-tv-profile-\d{4}-\d{2}-\d{2}\.json$/);
	expect(path).toBeTruthy();

	if (!path) return;
	await page.locator('input[type=file]').setInputFiles(path);
	await expect(page.getByText('Apply import')).toBeVisible();
	await page.getByRole('button', { name: /Apply import/ }).click();
	await expect(page.getByText(/Import applied/)).toBeVisible();

	await page.locator('input[type=file]').setInputFiles({
		name: 'catalog.json',
		mimeType: 'application/json',
		buffer: Buffer.from('{"type":"cable-tv-catalog"}')
	});
	await expect(page.getByText(/This is a catalog file/)).toBeVisible();
	await expect(page.getByTestId('lineup-count')).toContainText('12 in lineup');
});

test('settings persist to the local profile', async ({ page }) => {
	await page.goto('/settings/');
	const autoplay = page.getByRole('switch', { name: 'Autoplay next' });
	await expect(autoplay).toHaveAttribute('aria-checked', 'true');
	await autoplay.click();
	await expect(autoplay).toHaveAttribute('aria-checked', 'false');
	await page.reload();
	await expect(page.getByRole('switch', { name: 'Autoplay next' })).toHaveAttribute(
		'aria-checked',
		'false'
	);
});

test('fake player advances to the next video and skips errors', async ({ page }) => {
	await openTv(page);
	const player = page.getByTestId('tv-player');
	await expect(player.getByText('Tuned')).toBeVisible();
	await expect.poll(() => selectedVideoId(page)).not.toBe('');
	const first = await selectedVideoId(page);
	const firstTitle = await player.getByTestId('player-video-title').innerText();

	await page.evaluate(() => {
		(window as unknown as { __cableTvFake: { end(): void } }).__cableTvFake.end();
	});
	await expect.poll(() => selectedVideoId(page), { timeout: 6_000 }).not.toBe(first);
	const secondTitle = await player.getByTestId('player-video-title').innerText();
	expect(secondTitle).not.toBe(firstTitle);
	await expect(player.getByText('Tuned')).toBeVisible();
	await page.waitForTimeout(250);

	const second = await selectedVideoId(page);
	await page.evaluate(() => {
		(window as unknown as { __cableTvFake: { error(code: number): void } }).__cableTvFake.error(
			150
		);
	});
	await expect.poll(() => selectedVideoId(page), { timeout: 12_000 }).not.toBe(second);
});

test('mobile channel drawer and tuning', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openTv(page);
	const sidebar = page.locator('aside').first();
	await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
	await page.getByRole('button', { name: 'Channels', exact: true }).click();
	await expect(sidebar).not.toHaveAttribute('aria-hidden', 'true');
	await page
		.locator('nav[aria-label="Channel lineup"]')
		.getByRole('button', { name: /Veritasium/ })
		.click();
	await expect(page).toHaveTitle(/Veritasium/);
	await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
});

const PROXY_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <yt:channelId>_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId>
  <title>Google for Developers</title>
  <entry>
    <yt:videoId>ProxyTest01</yt:videoId>
    <title>Proxy refresh test video</title>
    <published>2026-10-28T10:00:00+00:00</published>
    <media:group><media:thumbnail url="https://i.ytimg.com/vi/ProxyTest01/hqdefault.jpg" /></media:group>
  </entry>
</feed>`;

test('proxy feed refresh updates the live status', async ({ page }) => {
	await page.route('https://proxy.test/**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/xml',
			headers: { 'access-control-allow-origin': '*' },
			body: PROXY_FEED
		});
	});

	await page.goto('/settings/');
	await page
		.getByPlaceholder('https://your-worker.example/?url={url}')
		.fill('https://proxy.test/?url={url}');
	await page.getByRole('button', { name: 'Save proxy' }).click();
	await page.getByRole('button', { name: 'Test proxy' }).click();
	await expect(page.getByText(/Connected to Google for Developers/)).toBeVisible();

	await page.goto('/');
	await expect(page.getByText('on the dial')).toBeVisible();
	await page.getByRole('button', { name: 'Refresh', exact: true }).click();
	await expect(page.getByText(/Refreshed 1 channel/)).toBeVisible();
	await expect(page.getByText('Fresh', { exact: true })).toBeVisible();
});
