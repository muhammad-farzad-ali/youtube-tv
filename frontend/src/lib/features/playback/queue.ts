import type { VideoRecord } from '#lib/storage/database';

export type QueueOrder = 'newest' | 'oldest';

export function sortQueue(videos: VideoRecord[], order: QueueOrder): VideoRecord[] {
	return [...videos].sort((a, b) => {
		const diff = Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
		return order === 'oldest' ? diff : -diff;
	});
}

export function isEligible(video: VideoRecord, skipUnavailable: boolean): boolean {
	return !(skipUnavailable && video.availabilityStatus === 'unavailable');
}

export function firstEligibleIndex(videos: VideoRecord[], skipUnavailable: boolean): number {
	return videos.findIndex((video) => isEligible(video, skipUnavailable));
}

export function nextEligibleIndex(
	videos: VideoRecord[],
	from: number,
	options: { skipUnavailable: boolean; loop: boolean }
): number | null {
	for (let index = from + 1; index < videos.length; index++) {
		const video = videos[index];
		if (video && isEligible(video, options.skipUnavailable)) return index;
	}
	if (options.loop) {
		for (let index = 0; index <= from && index < videos.length; index++) {
			const video = videos[index];
			if (video && isEligible(video, options.skipUnavailable)) return index;
		}
	}
	return null;
}
