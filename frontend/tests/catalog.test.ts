import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogSchema } from '#lib/schemas/catalog.schema';

const raw = JSON.parse(readFileSync('static/catalog.json', 'utf8'));
const catalog = catalogSchema.parse(raw);

describe('managed catalog', () => {
	it('has the expected packs and channels', () => {
		expect(catalog.channels.length).toBeGreaterThanOrEqual(30);
		expect(catalog.packs.map((pack) => pack.id)).toEqual(
			expect.arrayContaining([
				'starter',
				'technology',
				'science',
				'news',
				'gaming',
				'learning',
				'developer',
				'comedy',
				'adventure'
			])
		);
		expect(catalog.starterChannelIds.length).toBeGreaterThanOrEqual(12);
		for (const packId of ['developer', 'comedy', 'adventure']) {
			expect(catalog.packs.find((pack) => pack.id === packId)?.channelIds.length).toBe(6);
		}
	});

	it('only references known channels', () => {
		const ids = new Set(catalog.channels.map((channel) => channel.id));
		for (const channelId of catalog.starterChannelIds) expect(ids.has(channelId)).toBe(true);
		for (const pack of catalog.packs) {
			for (const channelId of pack.channelIds) expect(ids.has(channelId)).toBe(true);
		}
	});

	it('ships snapshots with usable recent videos', () => {
		for (const channel of catalog.channels) {
			expect(channel.videos.length).toBeGreaterThan(0);
			expect(channel.videos.length).toBeLessThanOrEqual(30);
			const ids = new Set(channel.videos.map((video) => video.videoId));
			expect(ids.size).toBe(channel.videos.length);
			for (const video of channel.videos) {
				expect(video.videoId).toMatch(/^[A-Za-z0-9_-]{11}$/);
				expect(Date.parse(video.publishedAt)).not.toBeNaN();
				expect(video.thumbnailUrl).toMatch(/^https:\/\//);
			}
		}
	});

	it('uses https channel URLs and valid logos', () => {
		for (const channel of catalog.channels) {
			expect(channel.channelUrl).toBe(`https://www.youtube.com/channel/${channel.id}`);
			if (channel.logoUrl) expect(channel.logoUrl).toMatch(/^catalog\/logos\//);
		}
	});
});
