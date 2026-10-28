# Catalog Editorial Policy

This policy is the owner's default standard for the managed Cable TV catalog. A specific owner instruction overrides it. Record exceptions in the change summary.

## Product boundary

- The catalog is curated content, not a user playlist.
- Visitors choose from the catalog, favorite channels, and reorder their own dial.
- Visitors cannot add, edit, import, or delete channel definitions.
- Never add a channel to the app at runtime or introduce a user-facing import path for channel definitions.
- Profile import/export covers only the visitor's lineup, favorites, and settings.

## Channel standards

Prefer channels that are:

- **Primary or official.** The channel is the publisher, creator, or an authorized broadcaster, not a reupload or compilation farm.
- **Active.** At least one upload in the last 120 days, and ideally several recent entries in the RSS feed. A deliberately archival channel can be an exception with owner approval.
- **Useful on a cable dial.** The channel has a coherent identity and recurring programming, not a one-off topic or abandoned experiment.
- **Embeddable.** RSS does not prove embedding permission. Spot-check a recent video in the player when this is uncertain.
- **Distinct.** No duplicate channel IDs, duplicate brands, or two entries for the same publisher.
- **Safe to describe.** The display name and description are factual and do not make unsupported claims.
- **Appropriate for the intended audience.** Note language, mature themes, regional restrictions, or news bias where relevant; the owner makes the final call.

Avoid channels that are:

- name-only matches with no canonical ID verification
- inactive, deleted, private, or feed-empty
- primarily reuploads of other creators' work
- dependent on a single video or a temporary event
- obviously mislabeled relative to their category

## Categories

Use the owner's established categories unless they approve a new one:

- `Technology`
- `Science`
- `News`
- `Gaming`
- `Learning`
- `Software`
- `Comedy`
- `Adventure`

A channel belongs in the category that best describes its **regular programming**, not its most recent upload. When a channel spans several categories, choose the dominant one and mention the overlap in the change summary if it matters.

## Packs

The `starter` pack mirrors `starterChannelIds` and is the default first-visit lineup. The other packs are browsing collections.

Default composition:

- 5–7 channels per category pack, with 6 as the default
- a 12-channel starter lineup across the five flagship categories (Technology, Science, News, Gaming, Learning)
- additional category packs are opt-in unless the owner asks to rebalance the starter
- no duplicate channel within a pack
- every channel should belong to at least one non-starter pack
- starter entries must also exist in `channels`

Keep packs balanced. Do not quietly remove a channel to make room for a new one; propose the swap first. A channel may appear in more than one pack when it genuinely serves both audiences, but use that sparingly.

## Descriptions

Write one sentence, roughly 8–20 words:

- factual and specific to the channel's regular output
- neutral in tone; avoid "best", "must-watch", or marketing language
- no claims about upload frequency, audience size, or editorial independence unless verified
- no URLs, emoji, or promotional calls to action
- sentence case, ending with a period

## Change scope

Prefer the smallest useful change:

- add one channel to one pack and `channels`, unless the owner asks for starter inclusion
- do not refresh unrelated metadata by hand
- do not rename or recategorize existing channels unless requested or clearly wrong
- do not reorder existing channels without a reason
- do not delete channels as part of an "audit" without approval

A channel ID change is a remove-and-add operation. Never mutate an ID in place; it would silently point the old videos and lineup at a different publisher.

## Snapshot and freshness

- Generated snapshots are a cache of the latest RSS entries, not a full archive.
- RSS usually exposes around 15 recent uploads. Do not claim the catalog is complete.
- Refresh snapshots before shipping a catalog change.
- A snapshot older than 60 days is a review prompt, not an automatic failure.
- Feed errors retain cached videos in visitors' browsers; the catalog itself must still validate.

## Review checklist

Before committing:

- [ ] canonical channel ID resolved, not guessed
- [ ] feed has usable recent videos
- [ ] no duplicate ID or obvious duplicate brand
- [ ] category is correct for regular programming
- [ ] description follows the house style
- [ ] pack membership is intentional and balanced
- [ ] starter lineup still has 2–3 channels per category
- [ ] removed channels removed from every pack and the starter
- [ ] `catalog:sync` completed without failures
- [ ] `catalog:check`, unit tests, type checks, and build pass
- [ ] generated diff contains only intended changes
- [ ] embeddability and editorial fit flagged for the owner when uncertain

## Reporting exceptions

State any of the following explicitly in the final summary:

- archival or inactive channel kept on purpose
- uncertain embeddability
- a channel that spans categories
- a pack that intentionally violates the 6-channel default
- a new category or pack introduced at the owner's request
- an owner-approved channel with a non-official source
