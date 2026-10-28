import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogSchema } from '#lib/schemas/catalog.schema';

const raw = JSON.parse(readFileSync('static/catalog.json', 'utf8'));
const catalog = catalogSchema.parse(raw);

describe('managed catalog', () => {
	it('ships one ordered admin dial', () => {
		expect(catalog.schemaVersion).toBe(2);
		expect(catalog.channels).toHaveLength(48);
		expect(catalog).not.toHaveProperty('packs');
		expect(catalog).not.toHaveProperty('starterChannelIds');
		expect(new Set(catalog.channels.map((channel) => channel.id)).size).toBe(48);
	});

	it('keeps channel order stable and readable', () => {
		expect(catalog.channels[0]?.name).toBe('Google for Developers');
		for (const channel of catalog.channels) {
			expect(channel.name.trim()).not.toBe('');
			expect(channel.category.trim()).not.toBe('');
		}
	});

	it('ships snapshots with usable recent videos', () => {
		for (const channel of catalog.channels) {
			expect(channel.videos.length).toBeGreaterThan(0);
			expect(channel.videos.length).toBeLessThanOrEqual(30);
			const ids = new Set(channel.videos.map((video) => video.videoId));
			expect(ids.size).toBe(channel.videos.length);
			expect(Array.isArray(channel.shortVideoIds)).toBe(true);
			for (const shortId of channel.shortVideoIds) {
				expect(shortId).toMatch(/^[A-Za-z0-9_-]{11}$/);
				expect(ids.has(shortId)).toBe(false);
			}
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
