import { describe, expect, it } from 'vitest';
import { profileFileSchema } from '#lib/schemas/profile.schema';

const valid = {
	schemaVersion: 1,
	type: 'cable-tv-profile',
	name: 'My Cable TV',
	exportedAt: '2026-10-28T12:00:00.000Z',
	lineup: [
		{ channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', favorite: false },
		{ channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA', favorite: true }
	],
	settings: {
		autoplayNext: true,
		skipUnavailable: true,
		loopQueue: false,
		startOnSelect: true,
		startMuted: true,
		resumeLastVideo: false,
		sortOrder: 'newest',
		autoRefreshMinutes: 0,
		feedProxyUrl: '',
		sidebarCollapsed: false,
		crtEffects: true,
		numberStart: 1,
		volume: 70,
		muted: true,
		selectedChannelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
		lastPlayed: {}
	}
};

describe('profile backup schema', () => {
	it('accepts a valid profile', () => {
		expect(profileFileSchema.parse(valid).lineup).toHaveLength(2);
	});

	it('accepts a lineup-only profile with null settings', () => {
		expect(profileFileSchema.parse({ ...valid, settings: null }).settings).toBeNull();
	});

	it('rejects duplicate channel IDs', () => {
		const duplicate = {
			...valid,
			lineup: [valid.lineup[0], valid.lineup[0]]
		};
		expect(profileFileSchema.safeParse(duplicate).success).toBe(false);
	});

	it('rejects invalid channel IDs', () => {
		const invalid = {
			...valid,
			lineup: [{ channelId: 'not-a-channel', favorite: false }]
		};
		expect(profileFileSchema.safeParse(invalid).success).toBe(false);
	});

	it('rejects catalog files', () => {
		expect(profileFileSchema.safeParse({ ...valid, type: 'cable-tv-catalog' }).success).toBe(false);
	});
});
