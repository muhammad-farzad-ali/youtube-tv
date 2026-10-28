# Cable TV

A static, Tokyo Night styled cable television for a curated catalog of YouTube channels. Visitors choose channels from the managed lineup, arrange their own dial, and watch each channel play newest-to-oldest. YouTube Shorts are filtered out.

**Live:** <https://gitcommit.de/youtube-tv/>

Built with SvelteKit and `adapter-static`. No backend, accounts, database service, or API keys.

## Development

```bash
cd frontend
npm install
npm run dev
```

## Documentation

See [frontend/README.md](frontend/README.md) for:

- the managed catalog workflow (`data/catalog.source.json` → `static/catalog.json`)
- why YouTube RSS needs an optional proxy for live refresh
- profile import/export and browser storage
- testing, deployment, and GitHub Pages setup
- known limitations

## AI curation

The repo ships an OpenCode skill at [`.opencode/skills/catalog-curator/`](.opencode/skills/catalog-curator/SKILL.md). Use `@catalog-curator` to research channels, add/remove them, update packs and the starter lineup, refresh snapshots, and validate a catalog change.

Read-only helpers:

```bash
cd frontend
npm run catalog:inspect -- "https://www.youtube.com/@Veritasium"
npm run catalog:audit
```

## Quick commands

```bash
cd frontend
npm run catalog:check
npm run check
npm run test:run
npm run test:e2e
npm run build
```

## Theme

[Tokyo Night](https://tokyonight.org/) by Enkia.
