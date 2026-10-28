import { describe, expect, it, vi } from 'vitest';
import { filterShortVideos } from '#lib/features/feeds/shorts-filter';
import type { CatalogVideo } from '#lib/schemas/catalog.schema';
import { classificationFromOembed, oembedTarget } from '#lib/services/shorts';

function video(id: string): CatalogVideo {
	return {
		videoId: id.padEnd(11, 'x').slice(0, 11),
		title: id,
		thumbnailUrl: `https://i.ytimg.com/vi/${id.padEnd(11, 'x').slice(0, 11)}/hqdefault.jpg`,
		publishedAt: '2026-10-28T00:00:00.000Z'
	};
}

describe('strict Shorts filtering', () => {
	it('keeps known and classified long videos and drops Shorts plus unknown IDs', async () => {
		const knownLong = video('KnownLong');
		const knownShort = video('KnownShort');
		const classifiedLong = video('ClassLong');
		const classifiedShort = video('ClassShort');
		const unknown = video('Unknown');
		const classify = vi.fn(async (id: string) => {
			if (id === classifiedLong.videoId) return 'long' as const;
			if (id === classifiedShort.videoId) return 'short' as const;
			return 'unknown' as const;
		});

		const result = await filterShortVideos(
			[knownLong, knownShort, classifiedLong, classifiedShort, unknown],
			{
				knownLong: new Set([knownLong.videoId]),
				knownShort: new Set([knownShort.videoId]),
				classify
			}
		);

		expect(result.keep.map((item) => item.title)).toEqual(['KnownLong', 'ClassLong']);
		expect(result.skippedShorts).toBe(2);
		expect(result.skippedUnknown).toBe(1);
		expect(classify).toHaveBeenCalledTimes(3);
	});

	it('treats classifier errors as unverified and drops the video', async () => {
		const result = await filterShortVideos([video('Broken')], {
			knownLong: new Set(),
			knownShort: new Set(),
			classify: async () => {
				throw new Error('proxy unavailable');
			}
		});
		expect(result.keep).toHaveLength(0);
		expect(result.skippedUnknown).toBe(1);
	});
});

describe('oEmbed Shorts classification', () => {
	it('uses vertical dimensions for Shorts and horizontal dimensions for long videos', () => {
		expect(classificationFromOembed({ width: 113, height: 200 })).toBe('short');
		expect(classificationFromOembed({ width: 200, height: 113 })).toBe('long');
		expect(classificationFromOembed({ width: 200 })).toBe('unknown');
		expect(classificationFromOembed(null)).toBe('unknown');
	});

	it('builds an encoded oEmbed target for the proxy', () => {
		expect(oembedTarget('Kap7mRzr13w')).toContain(
			'https%3A%2F%2Fwww.youtube.com%2Fshorts%2FKap7mRzr13w'
		);
	});
});
