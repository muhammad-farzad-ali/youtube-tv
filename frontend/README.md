# Cable TV Lite

A static, Tokyo Night styled cable television for a fixed catalog of YouTube channels. The site owner controls the channel list and dial order; visitors tune channels and watch each one play newest-to-oldest. YouTube Shorts are filtered out.

No accounts, backend, database service, proxy, or API keys.

## Stack

- **SvelteKit 3 + Svelte 5** with `@sveltejs/adapter-static`
- One prerendered route: `/`
- **Tailwind CSS v4** with a Tokyo Night design token layer
- **Zod** for catalog validation
- **YouTube IFrame Player API** for playback
- **Vitest** and **Playwright** for tests

Visitors get a fixed dial plus local pins and favorites. There is no profile, IndexedDB store, video cache, lineup editor, settings page, backup flow, feed refresh, or proxy. Pins and favorites are the only persisted state, and the active channel is kept in the URL as `?ch=…`.

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

Channels are not editable in the app. The repository owner manages them through:

| File                       | Purpose                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| `data/catalog.source.json` | Hand-edited source of truth: channel metadata and dial order                   |
| `static/catalog.json`      | Generated runtime catalog with verified videos, snapshot dates, and logo paths |
| `static/catalog/logos/`    | Downloaded channel avatars used by the generated catalog                       |

The **order of `channels` in the source file is the channel order on the dial**. The current fixed dial contains 48 channels.

### Add, remove, or reorder channels

1. Resolve and inspect a candidate first:

```bash
npm run catalog:inspect -- "https://www.youtube.com/@Veritasium"
```

2. Edit `data/catalog.source.json`.
3. Run:

```bash
npm run catalog:sync
npm run catalog:check
```

`catalog:sync` fetches each channel's YouTube RSS feed, verifies recent uploads, classifies and excludes YouTube Shorts, downloads the avatar, and rewrites `static/catalog.json`. It fails if a channel ID is invalid or no long-form videos remain. Each channel stores `shortVideoIds` as a classification cache; the first sync does one public oEmbed check per video, and later syncs only check new IDs.

To remove a channel, delete it from `channels`, run the sync, and remove its orphaned logo file if it is no longer referenced.

For a read-only health review:

```bash
npm run catalog:audit
npm run catalog:audit -- --json
```

The audit reports stale channels, old snapshots, channels with few long-form videos, possible duplicate names, and hidden Short counts.

### AI-assisted curation

The repository includes an OpenCode skill at `.opencode/skills/catalog-curator/`. Ask OpenCode to use `@catalog-curator` when adding channels, reordering the dial, refreshing snapshots, or auditing the catalog. The skill enforces canonical ID resolution, the managed-service boundary, validation, and the editorial policy in its `references/editorial-policy.md`.

### Catalog format

```json
{
	"schemaVersion": 2,
	"type": "cable-tv-catalog",
	"name": "Cable TV",
	"updatedAt": "2026-10-28T12:00:00.000Z",
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

`catalog:check` validates the source and generated files, including:

- 24-character `UC…` channel IDs
- unique channel IDs
- matching source/generated channel order
- `https` channel URLs
- unique 11-character video IDs
- snapshot dates and video metadata
- no overlap between `videos` and `shortVideoIds`
- logo files on disk

Commit both the source and generated catalog files. The deployed site is fully static.

## How the app works

- `catalog:sync` produces the only playback data. The app fetches `catalog.json` at startup.
- The first channel in the catalog is the default. `?ch=<channelId>` selects a channel and survives reloads.
- Playback reads `channel.videos` directly and sorts newest first.
- Playback behavior is fixed: autoplay next, start muted, in-memory volume, skip failed videos, no loop.
- Channel search and category filtering are local UI state only.
- Pins and favorites persist in `localStorage` as channel IDs. They do not affect the admin dial order, channel numbers, or playback queue.
- Refreshing the browser is the only way to pick up new videos after an admin deploy.

### Pins and favorites

- **Pin** keeps a channel in a separate group at the top of the sidebar. Pinned channels keep their original channel numbers and dial order.
- **Favorite** marks a channel with a star and adds it to the **Favorites** filter in the category menu.
- Both are per-browser preferences stored under `cable-tv:preferences:v1`. Only channel IDs are saved; no profile, video history, or playback state is stored.
- Use the pin or star button again to remove the preference. Clearing site data resets everything.

## Shorts policy

Shorts are excluded from the catalog.

- `catalog:sync` classifies each feed video through YouTube's public oEmbed endpoint using the `/shorts/<id>` URL.
- Vertical oEmbed dimensions mean Short; horizontal means long-form.
- Unverifiable videos are excluded under strict mode.
- `shortVideoIds` is both the exclusion cache and the source of truth for known Shorts.

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

## Known limitations

- YouTube RSS exposes only recent uploads (usually ~15), not full channel history. Shorts are filtered out of that window.
- Some Shorts-heavy channels have only 1–2 long-form videos in the latest snapshot. The audit flags these for owner review.
- New videos require the owner to run `catalog:sync` and deploy the updated catalog.
- Some videos are private, age-restricted, region-restricted, or have embedding disabled.
- Autoplay policies may require a click; the player starts muted and shows an unmute control.
- Channel avatars are bundled at sync time.
- There is no offline service worker; the static app and catalog must load from the host.
- Pins and favorites live in this browser's `localStorage`; there is no account or cross-device sync. Clearing site data resets them.

## Project layout

```text
frontend/
├── data/catalog.source.json
├── scripts/
│   ├── sync-catalog.mjs
│   ├── validate-catalog.mjs
│   ├── audit-catalog.mjs
│   ├── inspect-channel.mjs
│   └── lib/youtube.mjs
├── src/
│   ├── lib/
│   │   ├── components/
│   │   ├── features/playback/
│   │   ├── schemas/catalog.schema.ts
│   │   ├── services/youtubePlayer.ts
│   │   ├── stores/
│   │   └── utils/
│   └── routes/
├── static/catalog.json
└── static/catalog/logos/
```

## Theme

[Tokyo Night](https://tokyonight.org/) by Enkia. The app uses the Night palette (`#1a1b26`) with blue, cyan, yellow, red, and magenta accents.
