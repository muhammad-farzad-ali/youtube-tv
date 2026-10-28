import { describe, expect, it } from 'vitest';
import { sortNewest } from '#lib/features/playback/queue';
import type { CatalogVideo } from '#lib/schemas/catalog.schema';

function video(id: string, publishedAt: string): CatalogVideo {
	return {
		videoId: id.padEnd(11, 'x').slice(0, 11),
		title: id,
		thumbnailUrl: `https://i.ytimg.com/vi/${id.padEnd(11, 'x').slice(0, 11)}/hqdefault.jpg`,
		publishedAt
	};
}

describe('playback queue', () => {
	it('sorts newest first without mutating the catalog', () => {
		const oldest = video('oldest', '2026-01-01T00:00:00.000Z');
		const newest = video('newest', '2026-03-01T00:00:00.000Z');
		const middle = video('middle', '2026-02-01T00:00:00.000Z');
		const input = [oldest, newest, middle];

		expect(sortNewest(input).map((item) => item.title)).toEqual(['newest', 'middle', 'oldest']);
		expect(input.map((item) => item.title)).toEqual(['oldest', 'newest', 'middle']);
	});

	it('handles an empty queue', () => {
		expect(sortNewest([])).toEqual([]);
	});
});
