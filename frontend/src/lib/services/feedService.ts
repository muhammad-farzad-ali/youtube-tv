import { fetchChannelFeed, FeedError } from './rssClient';
import { classifyVideoViaProxy } from './shorts';
import { filterShortVideos } from '#lib/features/feeds/shorts-filter';
import { recordSyncError, saveFeedVideos } from '#lib/storage/database';
import { catalog } from '#lib/stores/catalog.svelte';

export interface RefreshResult {
	channelId: string;
	ok: boolean;
	added: number;
	updated: number;
	via?: 'direct' | 'proxy';
	skippedShorts: number;
	skippedUnknown: number;
	error?: string;
}

export async function refreshChannel(channelId: string, proxyUrl: string): Promise<RefreshResult> {
	try {
		const feed = await fetchChannelFeed(channelId, proxyUrl);
		const filtered = await filterShortVideos(feed.videos, {
			knownLong: catalog.longVideoIds,
			knownShort: catalog.shortVideoIds,
			classify: (videoId) =>
				proxyUrl.trim() ? classifyVideoViaProxy(videoId, proxyUrl) : Promise.resolve('unknown')
		});
		const { added, updated } = await saveFeedVideos(channelId, filtered.keep, feed.via);
		return {
			channelId,
			ok: true,
			added,
			updated,
			via: feed.via,
			skippedShorts: filtered.skippedShorts,
			skippedUnknown: filtered.skippedUnknown
		};
	} catch (cause) {
		const message =
			cause instanceof FeedError
				? cause.message
				: cause instanceof Error
					? cause.message
					: 'Feed refresh failed.';
		await recordSyncError(channelId, message);
		return {
			channelId,
			ok: false,
			added: 0,
			updated: 0,
			skippedShorts: 0,
			skippedUnknown: 0,
			error: message
		};
	}
}

export async function refreshChannels(
	channelIds: string[],
	proxyUrl: string,
	onProgress?: (completed: number, total: number, result: RefreshResult) => void
): Promise<RefreshResult[]> {
	const results: RefreshResult[] = [];
	const queue = [...channelIds];
	let completed = 0;

	async function worker() {
		while (queue.length > 0) {
			const channelId = queue.shift();
			if (!channelId) return;
			const result = await refreshChannel(channelId, proxyUrl);
			results.push(result);
			completed++;
			onProgress?.(completed, channelIds.length, result);
		}
	}

	await Promise.all(Array.from({ length: Math.min(3, channelIds.length) }, worker));
	return results;
}

export function summarizeRefresh(results: RefreshResult[]): string {
	const ok = results.filter((result) => result.ok);
	const failed = results.length - ok.length;
	const added = ok.reduce((total, result) => total + result.added, 0);
	const skippedShorts = ok.reduce((total, result) => total + result.skippedShorts, 0);
	const skippedUnknown = ok.reduce((total, result) => total + result.skippedUnknown, 0);
	const skipNotes = [
		skippedShorts > 0 ? `${skippedShorts} Short${skippedShorts === 1 ? '' : 's'} skipped` : '',
		skippedUnknown > 0
			? `${skippedUnknown} unclassified skipped — allow YouTube oEmbed in the proxy`
			: ''
	].filter(Boolean);
	const suffix = skipNotes.length ? ` ${skipNotes.join('; ')}.` : '';

	if (results.length === 0) return 'No channels to refresh.';
	if (failed === 0) {
		const base =
			added > 0
				? `Refreshed ${ok.length} channel${ok.length === 1 ? '' : 's'} — ${added} new video${added === 1 ? '' : 's'}.`
				: `Refreshed ${ok.length} channel${ok.length === 1 ? '' : 's'} — no new long-form videos.`;
		return `${base}${suffix}`;
	}
	if (ok.length === 0) {
		const error = results.find((result) => result.error)?.error ?? '';
		return `Refresh failed for ${failed} channel${failed === 1 ? '' : 's'}. ${error}`.trim();
	}
	return `Refreshed ${ok.length}, failed ${failed}.${suffix}`;
}
