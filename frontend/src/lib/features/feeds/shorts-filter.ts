import type { CatalogVideo } from '#lib/schemas/catalog.schema';

export type ShortClassification = 'short' | 'long' | 'unknown';

export interface ShortFilterOptions {
	knownLong: ReadonlySet<string>;
	knownShort: ReadonlySet<string>;
	classify: (videoId: string) => Promise<ShortClassification>;
	concurrency?: number;
}

export interface ShortFilterResult {
	keep: CatalogVideo[];
	skippedShorts: number;
	skippedUnknown: number;
}

/**
 * Filter Shorts out of a discovered feed. Known long videos skip classification
 * entirely; unknown IDs are classified and any unverifiable result is dropped
 * under the strict no-Shorts policy.
 */
export async function filterShortVideos(
	videos: CatalogVideo[],
	options: ShortFilterOptions
): Promise<ShortFilterResult> {
	const results = new Array<ShortClassification | 'known-long' | 'known-short'>(videos.length);
	const queue = videos.map((video, index) => ({ video, index }));
	let next = 0;
	const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, videos.length || 1));

	async function worker() {
		while (true) {
			const item = queue[next++];
			if (!item) return;
			const { video, index } = item;
			if (options.knownShort.has(video.videoId)) {
				results[index] = 'known-short';
				continue;
			}
			if (options.knownLong.has(video.videoId)) {
				results[index] = 'known-long';
				continue;
			}
			try {
				results[index] = await options.classify(video.videoId);
			} catch {
				results[index] = 'unknown';
			}
		}
	}

	await Promise.all(Array.from({ length: concurrency }, worker));

	const keep: CatalogVideo[] = [];
	let skippedShorts = 0;
	let skippedUnknown = 0;
	for (const [index, result] of results.entries()) {
		const video = videos[index];
		if (!video) continue;
		if (result === 'known-long' || result === 'long') keep.push(video);
		else if (result === 'known-short' || result === 'short') skippedShorts++;
		else skippedUnknown++;
	}

	return { keep, skippedShorts, skippedUnknown };
}
