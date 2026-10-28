# Cable TV Lite

A static, Tokyo Night styled cable television for a fixed catalog of YouTube channels. The repository owner controls the channel list and dial order; visitors simply tune channels and watch each one play newest-to-oldest. YouTube Shorts are filtered out.

Built with SvelteKit and `adapter-static`. No backend, accounts, database service, proxy, or API keys.

## Development

```bash
cd frontend
npm install
npm run dev
```

## Documentation

See [frontend/README.md](frontend/README.md) for:

- the managed catalog workflow (`data/catalog.source.json` → `static/catalog.json`)
- dial ordering, Shorts filtering, and admin refresh
- the deliberately stateless visitor experience
- testing, deployment, and GitHub Pages setup
- known limitations

## AI curation

The repo ships an OpenCode skill at [`.opencode/skills/catalog-curator/`](.opencode/skills/catalog-curator/SKILL.md). Use `@catalog-curator` to research channels, add or remove them, reorder the dial, refresh snapshots, and validate a catalog change.

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
