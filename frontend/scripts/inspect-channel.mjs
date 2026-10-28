#!/usr/bin/env node
/**
 * Inspect a YouTube channel before adding it to the managed catalog.
 *
 * Usage:
 *   npm run catalog:inspect -- "https://www.youtube.com/@Veritasium"
 *   npm run catalog:inspect -- UC_x5XG1OV2P6uZZ5FSM9Ttw
 *   npm run catalog:inspect -- "@Veritasium" --json
 *   npm run catalog:inspect -- "https://youtube.com/@Veritasium" --limit 5
 *
 * This is a research tool. It does not edit the catalog.
 */
import {
	canonicalChannelUrl,
	fetchChannelFeed,
	isValidChannelId,
	resolveChannelInput
} from './lib/youtube.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 10;
const input = args.find((arg, index) => {
	if (arg === '--json') return false;
	if (arg === '--limit') return false;
	if (index > 0 && args[index - 1] === '--limit') return false;
	return true;
});

function fail(message) {
	console.error(`✖ ${message}`);
	process.exit(1);
}

if (!input) {
	console.error(
		'Usage: npm run catalog:inspect -- <channel-id|@handle|youtube-url> [--json] [--limit 10]'
	);
	process.exit(1);
}
if (!Number.isFinite(limit) || limit < 1 || limit > 30) fail('--limit must be between 1 and 30.');

try {
	const resolved = await resolveChannelInput(input);
	if (!isValidChannelId(resolved.channelId)) fail('Resolved channel ID is not valid.');
	const feed = await fetchChannelFeed(resolved.channelId, limit);
	const latest = feed.videos[0];
	const daysSinceLatest = latest
		? Math.floor((Date.now() - Date.parse(latest.publishedAt)) / 86_400_000)
		: null;

	const result = {
		input,
		channelId: resolved.channelId,
		channelUrl: canonicalChannelUrl(resolved.channelId),
		displayName: feed.feedTitle || resolved.pageTitle,
		feedTitle: feed.feedTitle,
		resolvedFrom: resolved.resolvedFrom,
		recentVideoCount: feed.videos.length,
		latestPublishedAt: latest?.publishedAt ?? null,
		daysSinceLatest,
		activeWithin120Days: daysSinceLatest !== null && daysSinceLatest <= 120,
		note: 'RSS exposes only recent uploads. This does not prove that every video is embeddable.',
		videos: feed.videos
	};

	if (json) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(`\n${result.displayName}`);
		console.log(`  channel ID   ${result.channelId}`);
		console.log(`  channel URL  ${result.channelUrl}`);
		console.log(`  resolved via ${result.resolvedFrom}`);
		console.log(`  recent       ${result.recentVideoCount} videos in the feed`);
		console.log(
			`  latest       ${latest ? `${latest.publishedAt} (${daysSinceLatest} days ago)` : 'none'}`
		);
		console.log(
			`  activity     ${result.activeWithin120Days ? 'active within 120 days' : '⚠ stale — review before adding'}`
		);
		console.log('\n  Latest videos:');
		for (const video of feed.videos) {
			const date = video.publishedAt.slice(0, 10);
			console.log(`    ${date}  ${video.videoId}  ${video.title}`);
		}
		console.log(`\n  ${result.note}\n`);
	}
} catch (error) {
	fail(error instanceof Error ? error.message : String(error));
}
