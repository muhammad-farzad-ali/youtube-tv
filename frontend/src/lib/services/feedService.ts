import { fetchChannelFeed, FeedError } from './rssClient';
import { recordSyncError, saveFeedVideos } from '#lib/storage/database';

export interface RefreshResult {
	channelId: string;
	ok: boolean;
	added: number;
	updated: number;
	via?: 'direct' | 'proxy';
	error?: string;
}

export async function refreshChannel(
	channelId: string,
	proxyUrl: string
): Promise<RefreshResult> {
	try {
		const feed = await fetchChannelFeed(channelId, proxyUrl);
		const { added, updated } = await saveFeedVideos(channelId, feed.videos, feed.via);
		return { channelId, ok: true, added, updated, via: feed.via };
	} catch (cause) {
		const message =
			cause instanceof FeedError
				? cause.message
				: cause instanceof Error
					? cause.message
					: 'Feed refresh failed.';
		await recordSyncError(channelId, message);
		return { channelId, ok: false, added: 0, updated: 0, error: message };
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
	if (results.length === 0) return 'No channels to refresh.';
	if (failed === 0) {
		return added > 0
			? `Refreshed ${ok.length} channel${ok.length === 1 ? '' : 's'} — ${added} new video${added === 1 ? '' : 's'}.`
			: `Refreshed ${ok.length} channel${ok.length === 1 ? '' : 's'} — already up to date.`;
	}
	if (ok.length === 0) {
		const error = results.find((result) => result.error)?.error ?? '';
		return `Refresh failed for ${failed} channel${failed === 1 ? '' : 's'}. ${error}`.trim();
	}
	return `Refreshed ${ok.length}, failed ${failed}.`;
}
