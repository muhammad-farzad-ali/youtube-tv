import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const rawBase = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');
const base = (rawBase === '' ? '' : rawBase.startsWith('/') ? rawBase : `/${rawBase}`) as
	'' | `/${string}`;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: undefined,
				precompress: true,
				strict: true
			}),
			paths: {
				base,
				relative: true
			}
		})
	]
});
