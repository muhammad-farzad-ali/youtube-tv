import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogSchema } from '#lib/schemas/catalog.schema';

const raw = JSON.parse(readFileSync('static/catalog.json', 'utf8'));
const catalog = catalogSchema.parse(raw);

describe('managed catalog', () => {
	it('ships one ordered admin dial', () => {
		expect(catalog.schemaVersion).toBe(2);
		expect(catalog.channels).toHaveLength(76);
		expect(catalog).not.toHaveProperty('packs');
		expect(catalog).not.toHaveProperty('starterChannelIds');
		expect(new Set(catalog.channels.map((channel) => channel.id)).size).toBe(76);
	});

	it('keeps channel order stable and readable', () => {
		expect(catalog.channels[0]?.name).toBe('Google for Developers');
		expect(catalog.channels.at(-1)?.name).toBe('Deep Look');
		for (const channel of catalog.channels) {
			expect(channel.name.trim()).not.toBe('');
			expect(channel.category.trim()).not.toBe('');
		}
	});

	it('includes the requested and complementary channels', () => {
		const byName = new Map(catalog.channels.map((channel) => [channel.name, channel.category]));
		const expected: Record<string, string> = {
			NetworkChuck: 'Technology',
			'Andrew Huberman': 'Science',
			'Mark Rober': 'Science',
			'Practical Engineering': 'Science',
			'DW Documentary': 'News',
			'Syed Muzammil Official': 'News',
			'Johnny Harris': 'News',
			"Game Maker's Toolkit": 'Gaming',
			'Better Ideas': 'Learning',
			"Matt D'Avella": 'Learning',
			'Easy German': 'Learning',
			HealthyGamerGG: 'Learning',
			'Ahsan Finance': 'Learning',
			'Dekho Suno Jano': 'Learning',
			'Ali Abdaal': 'Learning',
			'The Coding Train': 'Software',
			'The Big Bang Theory': 'Comedy',
			'Kara and Nate': 'Adventure',
			'BBC Earth': 'Nature',
			'National Geographic': 'Nature',
			'Nat Geo Animals': 'Nature',
			'Love Nature': 'Nature',
			'Nature on PBS': 'Nature',
			'The Nature of Things': 'Nature',
			Animalogic: 'Nature',
			'BBC Earth Science': 'Science',
			'PBS Eons': 'Science',
			'Deep Look': 'Science'
		};
		for (const [name, category] of Object.entries(expected)) {
			expect(byName.get(name)).toBe(category);
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
