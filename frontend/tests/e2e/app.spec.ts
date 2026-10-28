import { expect, test, type Page } from '@playwright/test';

async function openTv(page: Page) {
	await page.goto('/');
	await expect(page).toHaveTitle(/· Cable TV/);
}

async function selectedVideoId(page: Page): Promise<string> {
	return page.evaluate(() => {
		const fake = (window as unknown as { __cableTvFake?: { getVideoId(): string } }).__cableTvFake;
		return fake?.getVideoId() ?? '';
	});
}

async function selectedQuality(page: Page): Promise<string> {
	return page.evaluate(() => {
		const fake = (window as unknown as { __cableTvFake?: { getQuality(): string } }).__cableTvFake;
		return fake?.getQuality() ?? '';
	});
}

function channelRow(page: Page, name: string) {
	return page
		.locator('nav[aria-label="Channel lineup"]')
		.getByTestId('channel-row')
		.filter({ hasText: name });
}

function channelButton(page: Page, name: string) {
	return channelRow(page, name).getByRole('button').first();
}

test('fixed dial, channel switching, number tuning and URL persistence', async ({ page }) => {
	await openTv(page);
	await expect(page.getByText('76 on the dial')).toBeVisible();
	await expect(page).toHaveTitle(/Google for Developers/);

	await channelButton(page, 'Linus Tech Tips').click();
	await expect(page).toHaveTitle(/Linus Tech Tips/);
	await expect(page).toHaveURL(/ch=UCXuqSBlHAE6Xw-yeJA0Tunw/);

	await page.keyboard.type('07');
	await page.keyboard.press('Enter');
	await expect(page).toHaveTitle(/Veritasium/);

	await page.reload();
	await expect(page.getByText('76 on the dial')).toBeVisible();
	await expect(page).toHaveTitle(/Veritasium/);
});

test('channel search and category filters narrow the fixed dial', async ({ page }) => {
	await openTv(page);
	const search = page.getByRole('searchbox', { name: 'Search channels' });
	await search.fill('space');
	await expect(channelRow(page, 'PBS Space Time')).toBeVisible();
	await expect(channelRow(page, 'Linus Tech Tips')).toHaveCount(0);

	await search.fill('');
	await page.getByRole('combobox', { name: 'Filter by category' }).selectOption('Science');
	await expect(channelRow(page, 'NASA')).toBeVisible();
	await expect(channelRow(page, 'Linus Tech Tips')).toHaveCount(0);
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
	await channelButton(page, 'Veritasium').click();
	await expect(page).toHaveTitle(/Veritasium/);
	await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
});

test('pins and favorites channels with local persistence', async ({ page }) => {
	await openTv(page);
	const nav = page.locator('nav[aria-label="Channel lineup"]');
	const linusRow = nav.getByTestId('channel-row').filter({ hasText: 'Linus Tech Tips' });

	await linusRow.getByRole('button', { name: 'Pin Linus Tech Tips' }).click();
	await expect(nav.getByText('Pinned')).toBeVisible();
	await expect(nav.getByTestId('channel-row').first()).toContainText('Linus Tech Tips');
	await expect(page).toHaveTitle(/Google for Developers/);

	await linusRow.getByRole('button', { name: 'Add Linus Tech Tips to favorites' }).click();
	await expect(
		nav.getByRole('button', { name: 'Remove Linus Tech Tips from favorites' })
	).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Filter by category' })).toContainText(
		'Favorites (1)'
	);

	await page.getByRole('combobox', { name: 'Filter by category' }).selectOption('Favorites');
	await expect(nav.getByTestId('channel-row')).toHaveCount(1);
	await expect(nav.getByTestId('channel-row').first()).toContainText('Linus Tech Tips');

	const saved = await page.evaluate(() => {
		const raw = localStorage.getItem('cable-tv:preferences:v1');
		return raw ? (JSON.parse(raw) as { pinned: string[]; favorites: string[] }) : null;
	});
	expect(saved?.pinned).toContain('UCXuqSBlHAE6Xw-yeJA0Tunw');
	expect(saved?.favorites).toContain('UCXuqSBlHAE6Xw-yeJA0Tunw');

	await page.reload();
	await expect(page).toHaveTitle(/Google for Developers/);
	await expect(nav.getByTestId('channel-row').first()).toContainText('Linus Tech Tips');
	await expect(nav.getByRole('button', { name: 'Unpin Linus Tech Tips' })).toBeVisible();
	await expect(
		nav.getByRole('button', { name: 'Remove Linus Tech Tips from favorites' })
	).toBeVisible();
});

test('hides and unhides channels with local persistence', async ({ page }) => {
	await openTv(page);
	const categoryFilter = page.getByRole('combobox', { name: 'Filter by category' });
	const veritasium = channelRow(page, 'Veritasium');

	await veritasium.getByRole('button', { name: 'Hide Veritasium' }).click();
	await expect(channelRow(page, 'Veritasium')).toHaveCount(0);
	await expect(categoryFilter).toContainText('Hidden (1)');

	await page.keyboard.type('06');
	await page.keyboard.press('Enter');
	await expect(page).toHaveTitle(/Techquickie/);
	await page.keyboard.press('ArrowDown');
	await expect(page).toHaveTitle(/Kurzgesagt/);
	await page.keyboard.type('01');
	await page.keyboard.press('Enter');
	await expect(page).toHaveTitle(/Google for Developers/);

	await categoryFilter.selectOption('Hidden');
	await expect(channelRow(page, 'Veritasium')).toHaveCount(1);
	await expect(
		channelRow(page, 'Veritasium').getByRole('button', { name: 'Unhide Veritasium' })
	).toBeVisible();

	await page.reload();
	await expect(page).toHaveTitle(/Google for Developers/);
	await categoryFilter.selectOption('Hidden');
	await expect(channelRow(page, 'Veritasium')).toHaveCount(1);

	await channelRow(page, 'Veritasium').getByRole('button', { name: 'Unhide Veritasium' }).click();
	await expect(channelRow(page, 'Veritasium')).toHaveCount(0);

	await categoryFilter.selectOption('All');
	await expect(channelRow(page, 'Veritasium')).toHaveCount(1);
});

test('requests 720p playback quality', async ({ page }) => {
	await openTv(page);
	await expect.poll(() => selectedQuality(page)).toBe('hd720');
});

test('fullscreen hides player chrome and restores it on exit', async ({ page }) => {
	await openTv(page);
	await expect(page.getByTestId('player-topbar')).toBeVisible();
	await page.getByRole('button', { name: 'Toggle fullscreen' }).click();
	await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
	await expect(page.getByTestId('player-topbar')).toBeHidden();
	await expect(page.getByTestId('player-controls')).toBeHidden();
	await page.getByRole('button', { name: 'Exit fullscreen' }).click();
	await expect(page.getByTestId('player-topbar')).toBeVisible();
	await expect(page.getByTestId('player-controls')).toBeVisible();
});

test('starts without profile or video caches', async ({ page }) => {
	await openTv(page);
	const state = await page.evaluate(async () => {
		const databases =
			typeof indexedDB.databases === 'function'
				? (await indexedDB.databases()).map((database) => database.name)
				: [];
		return { databases, localStorageKeys: Object.keys(localStorage) };
	});
	expect(state.databases).not.toContain('cable-tv');
	expect(state.localStorageKeys).toEqual([]);
});

test('shows a signal error when the catalog cannot load', async ({ page }) => {
	await page.route('**/catalog.json', (route) =>
		route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
	);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Signal lost' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
