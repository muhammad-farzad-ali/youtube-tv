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
import { XMLParser } from 'fast-xml-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'data/catalog.source.json');
const outputPath = path.join(root, 'static/catalog.json');
const logoDir = path.join(root, 'static/catalog/logos');

const UA =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FEED_LIMIT = 15;
const CONCURRENCY = 3;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	trimValues: true,
	parseTagValue: false
});

function fail(message) {
	console.error(`\n✖ ${message}`);
	process.exit(1);
}

function text(value) {
	if (value == null) return '';
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number') return String(value);
	if (Array.isArray(value)) return text(value[0]);
	if (typeof value === 'object') {
		if ('#text' in value) return text(value['#text']);
	}
	return '';
}

function asArray(value) {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function validChannelId(id) {
	return typeof id === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(id);
}

function validVideoId(id) {
	return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
}

async function fetchWithTimeout(url, options = {}, timeout = 20000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		return await fetch(url, {
			...options,
			signal: controller.signal,
			headers: {
				'user-agent': UA,
				'accept-language': 'en-US,en;q=0.9',
				...options.headers
			}
		});
	} finally {
		clearTimeout(timer);
	}
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

function parseFeed(xml, channelId) {
	const parsed = parser.parse(xml);
	const feed = parsed?.feed;
	if (!feed) throw new Error('Feed response was not a YouTube Atom feed');

	const feedTitle = text(feed.title);
	const entries = asArray(feed.entry);
	const videos = [];

	for (const entry of entries) {
		const videoId = text(entry?.['yt:videoId']);
		const title = text(entry?.title);
		const publishedAt = text(entry?.published);
		const mediaGroup = entry?.['media:group'];
		const thumbnails = asArray(mediaGroup?.['media:thumbnail']);
		const thumbnailUrl = thumbnails[0]?.['@_url'];

		if (!validVideoId(videoId) || !title || !publishedAt) continue;
		if (Number.isNaN(Date.parse(publishedAt))) continue;

		videos.push({
			videoId,
			title,
			thumbnailUrl: thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
			publishedAt: new Date(publishedAt).toISOString()
		});
	}

	videos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
	const deduped = [];
	const seen = new Set();
	for (const video of videos) {
		if (seen.has(video.videoId)) continue;
		seen.add(video.videoId);
		deduped.push(video);
	}

	if (deduped.length === 0) {
		throw new Error(`No usable videos found for ${channelId}`);
	}

	return { feedTitle, videos: deduped.slice(0, FEED_LIMIT) };
}

async function fetchLogo(channel, snapshotAt) {
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

async function buildChannel(channel, snapshotAt) {
	if (!validChannelId(channel.id)) {
		throw new Error(`Invalid channel ID: ${channel.id}`);
	}

	const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
	const response = await fetchWithTimeout(feedUrl);
	if (!response.ok) throw new Error(`feed returned ${response.status}`);
	const xml = await response.text();
	const { feedTitle, videos } = parseFeed(xml, channel.id);

	const normalizedFeedTitle = feedTitle.replace(/\s+/g, ' ').trim();
	if (
		normalizedFeedTitle &&
		normalizedFeedTitle.localeCompare(channel.name, undefined, { sensitivity: 'base' }) !== 0
	) {
		console.warn(`  ~ name mismatch for ${channel.id}: "${channel.name}" / "${normalizedFeedTitle}"`);
	}

	const logoUrl = await fetchLogo(channel, snapshotAt);
	const result = {
		id: channel.id,
		name: channel.name,
		channelUrl: channel.channelUrl,
		description: channel.description ?? '',
		category: channel.category,
		...(logoUrl ? { logoUrl } : {}),
		snapshotAt,
		videos
	};

	console.log(`  ✓ ${channel.name} — ${videos.length} videos${logoUrl ? ' + logo' : ''}`);
	return result;
}

async function main() {
	const source = JSON.parse(await readFile(sourcePath, 'utf8'));
	if (source.schemaVersion !== 1) fail('Unsupported source schema version');

	const channels = source.channels ?? [];
	if (!Array.isArray(channels) || channels.length === 0) fail('Source has no channels');

	const ids = new Set();
	for (const channel of channels) {
		if (ids.has(channel.id)) fail(`Duplicate channel ID in source: ${channel.id}`);
		ids.add(channel.id);
	}
	for (const channelId of source.starterChannelIds ?? []) {
		if (!ids.has(channelId)) fail(`Starter lineup references unknown channel: ${channelId}`);
	}
	for (const pack of source.packs ?? []) {
		for (const channelId of pack.channelIds ?? []) {
			if (!ids.has(channelId)) fail(`Pack ${pack.id} references unknown channel: ${channelId}`);
		}
	}

	const snapshotAt = new Date().toISOString();
	console.log(`Syncing ${channels.length} channels at ${snapshotAt}\n`);

	const built = await pool(channels, CONCURRENCY, async (channel) => {
		try {
			return await buildChannel(channel, snapshotAt);
		} catch (error) {
			fail(`Failed to sync ${channel.name} (${channel.id}): ${error.message}`);
		}
	});

	const generated = {
		schemaVersion: 1,
		type: 'cable-tv-catalog',
		name: source.name ?? 'Cable TV',
		updatedAt: snapshotAt,
		starterChannelIds: source.starterChannelIds ?? [],
		packs: source.packs ?? [],
		channels: built
	};

	await writeFile(outputPath, `${JSON.stringify(generated, null, '\t')}\n`);
	console.log(`\nWrote static/catalog.json (${built.length} channels).`);
}

main().catch((error) => fail(error.stack ?? error.message));
