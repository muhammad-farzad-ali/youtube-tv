#!/usr/bin/env node
/**
 * Read-only catalog audit for routine curation.
 *
 * Usage:
 *   npm run catalog:audit
 *   npm run catalog:audit -- --json
 *   npm run catalog:audit -- --stale-days 90
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'static/catalog.json');
const args = process.argv.slice(2);
const json = args.includes('--json');
const staleIndex = args.indexOf('--stale-days');
const staleDays = staleIndex >= 0 ? Number(args[staleIndex + 1]) : 120;

if (!Number.isFinite(staleDays) || staleDays < 7 || staleDays > 730) {
	console.error('✖ --stale-days must be between 7 and 730.');
	process.exit(1);
}

function daysSince(iso) {
	if (!iso) return null;
	const time = Date.parse(iso);
	return Number.isNaN(time) ? null : Math.floor((Date.now() - time) / 86_400_000);
}

function normalizeName(value) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

try {
	const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
	const channels = catalog.channels ?? [];
	const packs = catalog.packs ?? [];
	const starter = new Set(catalog.starterChannelIds ?? []);
	const packMembership = new Map();
	for (const pack of packs) {
		for (const channelId of pack.channelIds ?? []) {
			if (!packMembership.has(channelId)) packMembership.set(channelId, []);
			packMembership.get(channelId).push(pack.id);
		}
	}

	const duplicates = new Map();
	for (const channel of channels) {
		const key = normalizeName(channel.name);
		if (!duplicates.has(key)) duplicates.set(key, []);
		duplicates.get(key).push(channel.id);
	}

	const rows = channels.map((channel) => {
		const latest = channel.videos?.[0]?.publishedAt ?? null;
		const latestDays = daysSince(latest);
		return {
			id: channel.id,
			name: channel.name,
			category: channel.category,
			videoCount: channel.videos?.length ?? 0,
			latestPublishedAt: latest,
			latestDays,
			stale: latestDays !== null && latestDays > staleDays,
			snapshotDays: daysSince(channel.snapshotAt),
			packs: packMembership.get(channel.id) ?? [],
			inStarter: starter.has(channel.id)
		};
	});

	const categoryCounts = {};
	for (const row of rows) {
		categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
	}

	const report = {
		catalogUpdatedAt: catalog.updatedAt,
		staleDays,
		channelCount: rows.length,
		starterCount: starter.size,
		packCount: packs.length,
		categoryCounts,
		stale: rows.filter((row) => row.stale),
		snapshotOlderThan60Days: rows.filter(
			(row) => row.snapshotDays !== null && row.snapshotDays > 60
		),
		notInAnyPack: rows.filter((row) => row.packs.length === 0),
		notInStarter: rows.filter((row) => !row.inStarter),
		possibleDuplicateNames: [...duplicates.entries()]
			.filter(([, ids]) => ids.length > 1)
			.map(([name, ids]) => ({ name, ids })),
		channels: rows
	};

	if (json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(
			`\nCatalog: ${report.channelCount} channels · ${report.packCount} packs · ${report.starterCount} starter`
		);
		console.log(`Updated: ${report.catalogUpdatedAt}\n`);
		console.log('Channels:');
		for (const row of rows) {
			const flags = [row.stale ? 'STALE' : '', row.packs.length === 0 ? 'NO PACK' : '']
				.filter(Boolean)
				.join(' · ');
			console.log(
				`  ${row.stale ? '⚠' : '✓'} ${row.inStarter ? '★ ' : ''}${row.name} [${row.category}] — ${row.videoCount} videos · latest ${row.latestDays}d ago · ${row.packs.join(', ') || 'no pack'}${flags ? ` · ${flags}` : ''}`
			);
		}

		if (report.stale.length) {
			console.log(`\n⚠ ${report.stale.length} channel(s) have no upload in ${staleDays}+ days.`);
		}
		if (report.snapshotOlderThan60Days.length) {
			console.log(`⚠ ${report.snapshotOlderThan60Days.length} snapshot(s) are older than 60 days.`);
		}
		if (report.notInAnyPack.length) {
			console.log(`⚠ ${report.notInAnyPack.length} channel(s) are not in any pack.`);
		}
		if (report.possibleDuplicateNames.length) {
			console.log(`⚠ Possible duplicate channel names: ${report.possibleDuplicateNames.length}`);
		}
		console.log('\nThis is a review aid, not proof that a channel is embeddable or appropriate.\n');
	}
} catch (error) {
	console.error(`✖ Could not audit catalog: ${error instanceof Error ? error.message : error}`);
	process.exit(1);
}
