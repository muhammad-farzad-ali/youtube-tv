# Catalog Editorial Policy

This policy is the owner's default standard for the managed Cable TV Lite catalog. A specific owner instruction overrides it. Record exceptions in the change summary.

## Product boundary

- The catalog is a fixed broadcast dial, not a user playlist.
- Visitors tune channels, pin them to the top of their own sidebar, maintain a local favorite list, and hide channels from their own dial; they cannot edit, import, or reorder the catalog lineup.
- Visitors cannot add, edit, or delete channel definitions.
- Never add a channel to the app at runtime or introduce a user-facing import path.
- There is no visitor profile, backup, settings, feed refresh, or proxy in the lite app. Pins, favorites, and hidden-channel choices are local browser preferences only.

## Channel standards

Prefer channels that are:

- **Primary or official.** The channel is the publisher, creator, or an authorized broadcaster, not a reupload or compilation farm.
- **Active.** At least one upload in the last 120 days, and ideally several recent entries in the RSS feed. A deliberately archival channel can be an exception with owner approval.
- **Useful on a cable dial.** The channel has a coherent identity and recurring programming, not a one-off topic or abandoned experiment.
- **Embeddable.** RSS does not prove embedding permission. Spot-check a recent video in the player when this is uncertain.
- **Long-form.** Shorts are excluded by policy. A channel may still have many Shorts; judge it by its long-form output and flag it if fewer than 3 long-form videos are available.
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
- `Nature`

A channel belongs in the category that best describes its **regular programming**, not its most recent upload. When a channel spans several categories, choose the dominant one and mention the overlap in the change summary if it matters.

## Dial order

The `channels` array is the dial. Its order sets channel numbers and the sidebar order.

- Keep the strongest general-audience channels near the front so the first tune is a good one.
- Group related categories sensibly instead of scattering them randomly.
- Preserve the owner's ordering unless a reorder is requested or clearly improves the dial.
- Do not reorder unrelated channels as part of an add or remove change.
- Treat channel numbers as visible product behavior; mention any numbering changes in the summary.

## Descriptions

Write one sentence, roughly 8–20 words:

- factual and specific to the channel's regular output
- neutral in tone; avoid "best", "must-watch", or marketing language
- no claims about upload frequency, audience size, or editorial independence unless verified
- no URLs, emoji, or promotional calls to action
- sentence case, ending with a period

## Change scope

Prefer the smallest useful change:

- add one channel at the intended dial position
- remove one channel without reordering everything else
- do not refresh unrelated metadata by hand
- do not rename or recategorize existing channels unless requested or clearly wrong
- do not reorder the dial without a reason
- do not delete channels as part of an "audit" without approval

A channel ID change is a remove-and-add operation. Never mutate an ID in place; it would silently point the old videos at a different publisher.

## Snapshot and freshness

- Generated snapshots are a cache of the latest long-form RSS entries, not a full archive.
- Shorts are excluded with a public oEmbed orientation check. Known Shorts are cached in `shortVideoIds`; unverifiable videos are dropped under strict mode.
- Channels with fewer than 3 long-form videos in the latest snapshot are review candidates, not automatic removals.
- RSS usually exposes around 15 recent uploads. Do not claim the catalog is complete.
- Refresh snapshots before shipping a catalog change.
- A snapshot older than 60 days is a review prompt, not an automatic failure.
- The lite app does not refresh feeds; a catalog change requires a new deploy.

## Review checklist

Before committing:

- [ ] canonical channel ID resolved, not guessed
- [ ] feed has usable recent videos
- [ ] no duplicate ID or obvious duplicate brand
- [ ] category is correct for regular programming
- [ ] description follows the house style
- [ ] no Shorts in `videos`; `shortVideoIds` does not overlap long-form IDs
- [ ] dial position and numbering are intentional
- [ ] removed channels have no orphaned logo files
- [ ] `catalog:sync` completed without failures and applied the Shorts filter
- [ ] low long-form counts are flagged for the owner
- [ ] `catalog:check`, unit tests, type checks, and build pass
- [ ] generated diff contains only intended changes
- [ ] embeddability and editorial fit flagged for the owner when uncertain

## Reporting exceptions

State any of the following explicitly in the final summary:

- archival or inactive channel kept on purpose
- uncertain embeddability
- a channel that spans categories
- a deliberate dial reorder
- a new category introduced at the owner's request
- an owner-approved channel with a non-official source
