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

test('fixed dial, channel switching, number tuning and URL persistence', async ({ page }) => {
	await openTv(page);
	await expect(page.getByText('48 on the dial')).toBeVisible();
	await expect(page).toHaveTitle(/Google for Developers/);

	await page
		.locator('nav[aria-label="Channel lineup"]')
		.getByRole('button', { name: /Linus Tech Tips/ })
		.click();
	await expect(page).toHaveTitle(/Linus Tech Tips/);
	await expect(page).toHaveURL(/ch=UCXuqSBlHAE6Xw-yeJA0Tunw/);

	await page.keyboard.type('07');
	await page.keyboard.press('Enter');
	await expect(page).toHaveTitle(/Veritasium/);

	await page.reload();
	await expect(page.getByText('48 on the dial')).toBeVisible();
	await expect(page).toHaveTitle(/Veritasium/);
});

test('channel search and category filters narrow the fixed dial', async ({ page }) => {
	await openTv(page);
	const search = page.getByRole('searchbox', { name: 'Search channels' });
	await search.fill('space');
	await expect(
		page.locator('nav[aria-label="Channel lineup"]').getByRole('button', { name: /PBS Space Time/ })
	).toBeVisible();
	await expect(
		page
			.locator('nav[aria-label="Channel lineup"]')
			.getByRole('button', { name: /Linus Tech Tips/ })
	).toHaveCount(0);

	await search.fill('');
	await page.getByRole('combobox', { name: 'Filter by category' }).selectOption('Science');
	await expect(
		page.locator('nav[aria-label="Channel lineup"]').getByRole('button', { name: /NASA/ })
	).toBeVisible();
	await expect(
		page
			.locator('nav[aria-label="Channel lineup"]')
			.getByRole('button', { name: /Linus Tech Tips/ })
	).toHaveCount(0);
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

test('does not write profile or video caches', async ({ page }) => {
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
