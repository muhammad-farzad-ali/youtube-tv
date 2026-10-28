import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: 1,
	reporter: 'list',
	timeout: 30_000,
	expect: { timeout: 8_000 },
	use: {
		baseURL: 'http://127.0.0.1:4175',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'VITE_FAKE_PLAYER=1 npm run dev -- --host 127.0.0.1 --port 4175',
		url: 'http://127.0.0.1:4175',
		reuseExistingServer: false,
		timeout: 120_000
	}
});
