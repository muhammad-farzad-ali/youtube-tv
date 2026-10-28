# Cable TV

A static, Tokyo Night styled cable television for YouTube channels. The site owner curates a managed channel catalog; each visitor picks the channels that appear on their own dial, favorites them, and reorders the lineup. Playback runs newest-to-oldest through cached video snapshots, with an optional live RSS refresh.

No application backend, database service, user accounts, or API keys.

## Stack

- **SvelteKit 3 + Svelte 5** with `@sveltejs/adapter-static`
- Fully prerendered routes (`/`, `/lineup/`, `/import-export/`, `/settings/`)
- **Tailwind CSS v4** with a Tokyo Night design token layer
- **Dexie / IndexedDB** for cached video metadata and feed results
- **localStorage** for the user's lineup, favorites, and preferences
- **Zod** for catalog and profile validation
- **YouTube IFrame Player API** for playback
- **Vitest** and **Playwright** for tests

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Production build:

```bash
npm run build     # writes static output to frontend/build
npm run preview
```

## The managed catalog

Channels are **not** editable in the app. The repository owner manages them through two files:

| File                       | Purpose                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| `data/catalog.source.json` | Hand-edited source of truth: channels, categories, packs, starter lineup       |
| `static/catalog.json`      | Generated runtime catalog with verified videos, snapshot dates, and logo paths |
| `static/catalog/logos/`    | Downloaded channel avatars used by the generated catalog                       |

Current packs: **Starter Mix**, **Technology TV**, **Science & Discovery**, **News TV**, **Gaming TV**, **Learning TV**, **Developer TV**, **Comedy TV**, and **Adventure TV**.

### Add or change a channel

1. Resolve and inspect the candidate first:

```bash
npm run catalog:inspect -- "https://www.youtube.com/@Veritasium"
```

2. Edit `data/catalog.source.json`.
3. Add the channel to one or more packs and, if appropriate, `starterChannelIds`.
4. Run:

```bash
npm run catalog:sync
npm run catalog:check
```

`catalog:sync` fetches the channel's YouTube RSS feed, verifies recent uploads, classifies and excludes YouTube Shorts, downloads the avatar, and writes `static/catalog.json`. It fails if a channel ID is invalid or no long-form videos remain. Each channel stores `shortVideoIds` as a classification cache; the first sync does one public oEmbed check per video, and later syncs only check new IDs.

For a read-only health review:

```bash
npm run catalog:audit
npm run catalog:audit -- --json
```

The audit reports stale channels, old snapshots, channels outside packs, and possible duplicate names.

### AI-assisted curation

The repository includes an OpenCode skill at `.opencode/skills/catalog-curator/`. Ask OpenCode to use `@catalog-curator` when adding channels, rebalancing packs, refreshing snapshots, or auditing the catalog. The skill enforces canonical ID resolution, the managed-service boundary, validation, and the editorial policy in its `references/editorial-policy.md`.

`catalog:check` validates the source and generated files, including:

- 24-character `UC…` channel IDs
- unique channel IDs
- pack and starter references
- `https` channel URLs
- unique 11-character video IDs
- snapshot dates and video metadata
- logo files on disk

Commit both the source and generated catalog files. The deployed site is fully static.

### Catalog format

```json
{
	"schemaVersion": 1,
	"type": "cable-tv-catalog",
	"updatedAt": "2026-10-28T12:00:00.000Z",
	"starterChannelIds": ["UC_x5XG1OV2P6uZZ5FSM9Ttw"],
	"packs": [
		{
			"id": "technology",
			"name": "Technology TV",
			"description": "Developer education and computing.",
			"channelIds": ["UC_x5XG1OV2P6uZZ5FSM9Ttw"]
		}
	],
	"channels": [
		{
			"id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
			"name": "Google for Developers",
			"channelUrl": "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
			"category": "Technology",
			"description": "Developer tools and engineering talks.",
			"logoUrl": "catalog/logos/UC_x5XG1OV2P6uZZ5FSM9Ttw.jpg",
			"snapshotAt": "2026-10-28T12:00:00.000Z",
			"videos": [
				{
					"videoId": "LOP8ul3KqQI",
					"title": "Introducing Genie 4",
					"thumbnailUrl": "https://i.ytimg.com/vi/LOP8ul3KqQI/hqdefault.jpg",
					"publishedAt": "2026-10-27T12:00:00.000Z"
				}
			],
			"shortVideoIds": []
		}
	]
}
```

## Why live refresh needs a proxy

YouTube's RSS endpoints do not send `Access-Control-Allow-Origin`, so browser `fetch()` is blocked. The app therefore:

1. Ships **bundled snapshots** of the latest ~15 uploads per channel, with Shorts excluded, so it works immediately.
2. Offers an **optional user-configured feed proxy** for live refresh.
3. Shows snapshot and live status separately, and never presents cached data as live.
4. Uses strict Shorts filtering for live videos too. New videos are only added when the proxy can classify them as long-form; unverified videos are skipped.

Configure a proxy in **Settings → Feeds & refresh**. The URL template must contain `{url}`, where the encoded YouTube feed or oEmbed URL is substituted. The proxy must allow both:

- `https://www.youtube.com/feeds/videos.xml?…`
- `https://www.youtube.com/oembed?…`

```text
https://your-worker.example/?url={url}
```

Example Cloudflare Worker (optional, external to the static app):

```js
export default {
	async fetch(request) {
		const url = new URL(request.url);
		const target = url.searchParams.get('url');
		const allowed =
			/^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?/.test(target ?? '') ||
			/^https:\/\/www\.youtube\.com\/oembed\?/.test(target ?? '');
		if (!allowed) {
			return new Response('Invalid YouTube URL', { status: 400 });
		}
		const response = await fetch(target);
		const headers = {
			'access-control-allow-origin': '*',
			'cache-control': 'public, max-age=900'
		};
		const contentType = response.headers.get('content-type');
		if (contentType) headers['content-type'] = contentType;
		return new Response(response.body, { status: response.status, headers });
	}
};
```

The proxy sees the requested channel feed and oEmbed URLs. Do not put secrets or API keys in the static app. If you put a token in the proxy URL, it is stored in localStorage and included in profile exports.

## User data and backups

The portable file is a **profile**:

```json
{
	"schemaVersion": 1,
	"type": "cable-tv-profile",
	"name": "My Cable TV",
	"exportedAt": "2026-10-28T12:00:00.000Z",
	"lineup": [{ "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw", "favorite": false }],
	"settings": {
		"autoplayNext": true,
		"skipUnavailable": true,
		"loopQueue": false
	}
}
```

Exports are generated locally. Imports are validated against the current catalog; unknown channels can be skipped; invalid files never partially apply. Catalog files are rejected because only the site owner can change the channel list.

Browser storage can be cleared. Keep a profile backup if the lineup matters.

## Routes

| Route             | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `/`               | TV mode and program guide                                     |
| `/lineup/`        | Managed catalog, packs, lineup selection, favorites, ordering |
| `/import-export/` | Profile backup and restore                                    |
| `/settings/`      | Playback, feeds, appearance, numbering, storage               |

All routes are prerendered. There is no SPA fallback and no server runtime.

## Tests

```bash
npm run check       # svelte-check
npm run test:run    # unit tests
npx playwright install chromium
npm run test:e2e    # Playwright, uses a fake YouTube player
npm run catalog:check
npm run catalog:audit
npm run build
```

The Playwright config starts a dev server with `VITE_FAKE_PLAYER=1`, which stubs the YouTube API so queue advancement and error-skip behavior can be tested deterministically. The real IFrame player is used in normal dev/production builds.

## Deployment

The build is static. `paths.base` is read from `BASE_PATH`:

```bash
BASE_PATH=/my-repo npm run build
```

- **GitHub Pages:** enable Pages with the source set to **GitHub Actions**. The included workflow in `.github/workflows/deploy.yml` builds `frontend/`, sets the repository base path automatically, and publishes `frontend/build`.
- **Netlify / Cloudflare Pages:** build command `npm run build`, publish directory `frontend/build`, root directory `frontend`. Leave `BASE_PATH` empty for a root domain.
- **Any static host:** upload the contents of `frontend/build`.

Deep links work because every route exists as a real `index.html`.

## Known limitations

- YouTube RSS exposes only recent uploads (usually ~15), not full channel history. Shorts are filtered out of that window.
- Some Shorts-heavy channels have only 1–2 long-form videos in the latest snapshot. The audit flags these for owner review.
- Strict live filtering requires the proxy to allow YouTube oEmbed; otherwise new live videos are skipped.
- Direct browser RSS access is blocked by CORS; bundled snapshots are the reliable source.
- Some videos are private, age-restricted, region-restricted, or have embedding disabled.
- Autoplay policies may require a click; the player starts muted and shows an unmute control.
- Album/thumbnail data comes from YouTube's public feeds; channel avatars are bundled at sync time.
- Browser storage is local and can be lost.
- Shorts are intentionally excluded from catalog snapshots and live refresh; there is no in-app toggle to include them.
- There is no offline service worker; the static app and catalog must load from the host.
- Automatic refresh only runs while the tab is open and visible, never in the background.

## Theme

[Tokyo Night](https://tokyonight.org/) by Enkia. The app uses the Night palette (`#1a1b26`) with blue, cyan, yellow, red, and magenta accents.

## Project layout

```text
frontend/
├── data/catalog.source.json
├── static/catalog.json
├── static/catalog/logos/
├── scripts/sync-catalog.mjs
├── scripts/validate-catalog.mjs
├── src/lib/{components,features,schemas,services,storage,stores,utils}
├── src/routes/{+page.svelte,lineup,import-export,settings}
└── tests/{unit tests,e2e}
```
