#!/usr/bin/env node
/**
 * Refresh the managed catalog.
 *
 * Owner workflow:
 *   1. edit data/catalog.source.json
 *   2. npm run catalog:sync
 *   3. npm run catalog:check
 *
 * This is a development-time script. The deployed app is fully static.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
	classifyVideoOrientation,
	fetchWithTimeout,
	isValidChannelId,
	parseYouTubeFeed
} from './lib/youtube.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'data/catalog.source.json');
const outputPath = path.join(root, 'static/catalog.json');
const logoDir = path.join(root, 'static/catalog/logos');

const FEED_LIMIT = 15;
const CONCURRENCY = 3;
const CLASSIFY_CONCURRENCY = 2;

function fail(message) {
	console.error(`\n✖ ${message}`);
	process.exit(1);
}

async function pool(items, limit, worker) {
	const results = new Array(items.length);
	let next = 0;
	const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (true) {
			const index = next++;
			if (index >= items.length) return;
			results[index] = await worker(items[index], index);
		}
	});
	await Promise.all(runners);
	return results;
}

async function fetchLogo(channel) {
	if (channel.logoUrl) return channel.logoUrl;

	await mkdir(logoDir, { recursive: true });

	try {
		const page = await fetchWithTimeout(
			`https://www.youtube.com/channel/${channel.id}`,
			{ headers: { accept: 'text/html' } },
			20000
		);
		if (!page.ok) throw new Error(`channel page ${page.status}`);
		const html = await page.text();
		const match =
			html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ??
			html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i) ??
			html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
		if (!match?.[1]) throw new Error('no avatar URL');

		const imageUrl = match[1].replaceAll('&amp;', '&');
		const image = await fetchWithTimeout(imageUrl, {}, 20000);
		if (!image.ok) throw new Error(`avatar ${image.status}`);
		const type = image.headers.get('content-type') ?? 'image/jpeg';
		const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
		const filename = `${channel.id}.${ext}`;
		const bytes = new Uint8Array(await image.arrayBuffer());
		await writeFile(path.join(logoDir, filename), bytes);
		return `catalog/logos/${filename}`;
	} catch (error) {
		console.warn(`  ! logo unavailable for ${channel.name}: ${error.message}`);
		return undefined;
	}
}

async function classifyFeedVideos(videos, cache) {
	const results = await pool(videos, CLASSIFY_CONCURRENCY, async (video) => {
		if (cache?.short.has(video.videoId)) return { video, kind: 'short' };
		if (cache?.long.has(video.videoId)) return { video, kind: 'long' };
		const kind = await classifyVideoOrientation(video.videoId);
		if (kind === 'unknown') {
			console.warn(`  ! could not classify ${video.videoId} (${video.title.slice(0, 60)})`);
		}
		return { video, kind };
	});

	const longVideos = [];
	const shortVideoIds = [];
	let unverified = 0;
	for (const result of results) {
		if (result.kind === 'long') longVideos.push(result.video);
		else if (result.kind === 'short') shortVideoIds.push(result.video.videoId);
		else unverified++;
	}
	return { longVideos, shortVideoIds, unverified };
}

function buildCaches(oldCatalog) {
	const caches = new Map();
	for (const channel of oldCatalog?.channels ?? []) {
		if (!Array.isArray(channel.shortVideoIds)) continue;
		caches.set(channel.id, {
			long: new Set((channel.videos ?? []).map((video) => video.videoId)),
			short: new Set(channel.shortVideoIds)
		});
	}
	return caches;
}

async function buildChannel(channel, snapshotAt, cache) {
	if (!isValidChannelId(channel.id)) {
		throw new Error(`Invalid channel ID: ${channel.id}`);
	}

	const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
	const response = await fetchWithTimeout(feedUrl);
	if (!response.ok) throw new Error(`feed returned ${response.status}`);
	const xml = await response.text();
	const { feedTitle, videos } = parseYouTubeFeed(xml, FEED_LIMIT);
	const { longVideos, shortVideoIds, unverified } = await classifyFeedVideos(videos, cache);
	if (longVideos.length === 0) {
		throw new Error(
			`No long-form videos in the latest feed (${shortVideoIds.length} Shorts hidden, ${unverified} unverified).`
		);
	}

	const normalizedFeedTitle = feedTitle.replace(/\s+/g, ' ').trim();
	if (
		normalizedFeedTitle &&
		normalizedFeedTitle.localeCompare(channel.name, undefined, { sensitivity: 'base' }) !== 0
	) {
		console.warn(
			`  ~ name mismatch for ${channel.id}: "${channel.name}" / "${normalizedFeedTitle}"`
		);
	}

	const logoUrl = await fetchLogo(channel);
	const result = {
		id: channel.id,
		name: channel.name,
		channelUrl: channel.channelUrl,
		description: channel.description ?? '',
		category: channel.category,
		...(logoUrl ? { logoUrl } : {}),
		snapshotAt,
		videos: longVideos,
		shortVideoIds
	};

	console.log(
		`  ✓ ${channel.name} — ${longVideos.length} long, ${shortVideoIds.length} Shorts hidden${unverified ? `, ${unverified} unverified` : ''}${logoUrl ? ' + logo' : ''}`
	);
	return result;
}

async function main() {
	const source = JSON.parse(await readFile(sourcePath, 'utf8'));
	if (source.schemaVersion !== 2) fail('Unsupported source schema version');

	const channels = source.channels ?? [];
	if (!Array.isArray(channels) || channels.length === 0) fail('Source has no channels');

	const ids = new Set();
	for (const channel of channels) {
		if (ids.has(channel.id)) fail(`Duplicate channel ID in source: ${channel.id}`);
		ids.add(channel.id);
	}

	let oldCatalog = null;
	try {
		oldCatalog = JSON.parse(await readFile(outputPath, 'utf8'));
	} catch {
		oldCatalog = null;
	}
	const caches = buildCaches(oldCatalog);

	const snapshotAt = new Date().toISOString();
	console.log(`Syncing ${channels.length} channels at ${snapshotAt}\n`);

	const built = await pool(channels, CONCURRENCY, async (channel) => {
		try {
			return await buildChannel(channel, snapshotAt, caches.get(channel.id));
		} catch (error) {
			fail(`Failed to sync ${channel.name} (${channel.id}): ${error.message}`);
		}
	});

	const generated = {
		schemaVersion: 2,
		type: 'cable-tv-catalog',
		name: source.name ?? 'Cable TV',
		updatedAt: snapshotAt,
		channels: built
	};

	await writeFile(outputPath, `${JSON.stringify(generated, null, '\t')}\n`);
	console.log(`\nWrote static/catalog.json (${built.length} channels).`);
}

main().catch((error) => fail(error.stack ?? error.message));
