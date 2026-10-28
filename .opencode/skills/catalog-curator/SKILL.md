---
name: Catalog Curator
description: Curate the managed Cable TV channel catalog — research YouTube channels, add or remove them, update packs and the starter lineup, refresh long-form-only snapshots, filter Shorts, validate the generated feed, and prepare a deploy. Use for channel selection, feed curation, catalog source edits, or catalog sync failures.
---

# Catalog Curator

Cable TV is a managed service: the repository owner controls which channels exist, while visitors only choose, favorite, and reorder channels from that catalog. There is deliberately no in-app channel creation or editing.

## Use this skill when

- adding, removing, or replacing channels in the managed catalog
- creating, rebalancing, or auditing packs and the starter lineup
- refreshing snapshots and channel avatars
- investigating invalid channel IDs, empty feeds, or sync failures
- reviewing stale channels, duplicate brands, category balance, or weak descriptions
- preparing a catalog change for commit and deployment

Do not use this skill for bugs in a visitor's local lineup/profile unless the catalog is the cause.

## Read first

1. `frontend/README.md` — managed catalog section and catalog format
2. `frontend/data/catalog.source.json` — the only catalog file a human or agent edits
3. `frontend/scripts/sync-catalog.mjs`, `validate-catalog.mjs`, and `lib/youtube.mjs`
4. `references/editorial-policy.md` — channel and pack quality standards

Run commands from `frontend/`. Paths below are relative to the repository root unless stated otherwise.

## Guardrails

- Never invent a channel ID. Resolve a URL or handle to a canonical `UC…` ID first.
- Never identify a channel by display name alone.
- Never hand-edit `static/catalog.json`, `static/catalog/logos/`, or generated video entries. They are produced by `catalog:sync`.
- Never add user-facing channel CRUD, arbitrary channel imports, or hidden API keys.
- Do not remove or replace existing channels without explicit owner approval.
- Do not bypass a failed `catalog:sync` or `catalog:check` by weakening validation.
- Do not increase sync concurrency or hammer YouTube. The script intentionally limits concurrency.
- YouTube Shorts are excluded by policy. Never bypass the oEmbed check or hand-add a Short to `videos`.
- Keep the app static. No backend, proxy, or server database is added to the repo.

## Workflow

### 1. Establish the change

Identify whether the owner wants:

- a new channel added (and to which packs)
- a channel removed everywhere
- a pack rebalanced
- the starter lineup changed
- a snapshot refresh only
- an audit or recommendation

For removals, bulk changes, or anything that changes the starter lineup, confirm the intended result before editing. For a snapshot-only refresh, skip source edits.

### 2. Inspect the current state

```bash
cd frontend
npm run catalog:audit
```

Use `-- --json` when you need structured data. Check category counts, stale channels, channels outside packs, possible duplicate names, and snapshot age.

### 3. Research a candidate

```bash
npm run catalog:inspect -- "https://www.youtube.com/@Veritasium"
npm run catalog:inspect -- "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw" --json
```

The inspector reports the canonical channel ID, feed title, recent videos, latest upload date, and activity. It does not prove that every video is embeddable. Spot-check one recent video in the deployed player when embed availability matters.

If a handle cannot be resolved, ask the owner for the canonical `/channel/UC…` URL. Do not guess an ID from search results.

Check for duplicates against all existing IDs and obvious duplicate brands before proposing an addition.

### 4. Edit only the source catalog

Edit `frontend/data/catalog.source.json`:

- add a channel object with `id`, `name`, canonical `channelUrl`, `category`, and a short neutral `description`
- add the channel to the relevant pack(s)
- add it to `starterChannelIds` only if the owner explicitly wants it in the default lineup
- preserve the existing style, ordering, and indentation
- when removing a channel, remove it from `channels`, every pack, and the starter lineup
- changing a channel ID means removing the old entry and adding the new one

Use the established category names `Technology`, `Science`, `News`, `Gaming`, `Learning`, `Software`, `Comedy`, and `Adventure` unless the owner approves a new category.

### 5. Refresh generated data

```bash
npm run catalog:sync
```

This fetches every channel feed, verifies recent uploads, classifies and excludes Shorts through public oEmbed, downloads avatars, and rewrites `static/catalog.json`. The first run after a filter change checks every video; later runs reuse `shortVideoIds` and only check new IDs.

If any channel fails, stop. Fix the source or remove the invalid candidate; never patch the generated file.

### 6. Validate

```bash
npm run catalog:check
npm run test:run
npm run check
npm run build
```

Run `npm run format` if formatting checks fail, then `npm run format:check`.

A healthy catalog currently has:

- 48 channels as of the current baseline (the audit is the source of truth)
- 9 packs: `starter`, `technology`, `science`, `news`, `gaming`, `learning`, `developer`, `comedy`, `adventure`
- 12 starter channels across the five flagship categories; additional category packs are opt-in
- every non-starter channel belongs to at least one pack
- up to 15 recent long-form videos per channel (at least one), unique video IDs
- `shortVideoIds` for excluded Shorts, with no overlap against `videos`
- a logo file for each channel that has `logoUrl`

### 7. Review the diff

```bash
git diff --stat
git diff -- frontend/data/catalog.source.json
git status --short frontend/static/catalog/
```

`catalog:sync` refreshes `snapshotAt` and video metadata for every channel, so a large generated diff is expected. Focus on:

- the intended channel additions/removals
- pack membership and starter lineup
- display names, categories, and descriptions
- new logo files and no accidental logo deletions
- no unexpected channels in the generated catalog

If the generated diff contains a channel or pack change you did not intend, stop and inspect the source before committing.

### 8. Report and ship

Summarize:

- channels added/removed
- packs and starter changes
- snapshot date and video counts
- validation results
- anything the owner should manually review (embedding, editorial fit, stale channel)

Commit only after validation. Suggested commit subjects:

```text
catalog: add Veritasium to science
catalog: rebalance starter lineup
catalog: refresh channel snapshots
catalog: remove inactive channel
```

Push to `main` when the owner asks; GitHub Actions runs catalog validation, checks, unit tests, E2E tests, and deploys the static site.

## Shorts policy

Shorts are never included in the catalog or the playback queue.

- `catalog:sync` classifies each feed video through YouTube's public oEmbed endpoint using the `/shorts/<id>` URL.
- Vertical oEmbed dimensions mean Short; horizontal means long-form.
- Unverifiable videos are excluded under strict mode.
- `shortVideoIds` is both the exclusion cache and the source of truth for known Shorts.
- Live refresh uses the same oEmbed endpoint through the configured proxy. The proxy must allow `youtube.com/oembed` as well as feed URLs; otherwise new live videos are skipped.
- Do not add an in-app "show Shorts" toggle without an owner decision and a catalog regeneration.

## Routine curation audit

Run this periodically or when the owner asks for a review:

```bash
cd frontend
npm run catalog:sync
npm run catalog:audit
```

Review:

- channels with no upload in 120+ days
- snapshots older than 60 days
- channels missing from every pack
- duplicate names or overlapping brands
- category balance
- starter lineup freshness

Do not remove a stale channel automatically. Recommend action and wait for approval.

## Failure handling

| Symptom | Action |
| --- | --- |
| `Invalid channel ID` | Resolve the canonical URL or ID; do not guess |
| `No usable videos found` | Verify the channel is active; drop it or ask the owner |
| Feed HTTP 404 | The ID is wrong or the feed is unavailable; stop |
| Name mismatch warning | Confirm the source display name is the intended brand; keep or correct it explicitly |
| Logo unavailable | Sync falls back to a monogram; do not fabricate a logo |
| oEmbed cannot classify a video | Strict policy excludes it; investigate or rerun later |
| Rate limiting / timeouts | Rerun later; do not raise concurrency |
| `catalog:check` failure | Fix the source; never edit generated output to silence it |

## Supporting files

- `references/editorial-policy.md` — selection standards, pack composition, and review checklist
