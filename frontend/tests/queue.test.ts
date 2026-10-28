import { describe, expect, it } from 'vitest';
import { firstEligibleIndex, nextEligibleIndex, sortQueue } from '#lib/features/playback/queue';
import type { VideoRecord } from '#lib/storage/database';

function video(
	id: string,
	publishedAt: string,
	availabilityStatus: VideoRecord['availabilityStatus'] = 'unknown'
): VideoRecord {
	return {
		videoId: id.padEnd(11, 'x').slice(0, 11),
		channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
		title: id,
		publishedAt,
		availabilityStatus,
		source: 'snapshot',
		addedAt: '2026-01-01T00:00:00.000Z'
	};
}

const newest = video('newest', '2026-03-03T00:00:00.000Z');
const middle = video('middle', '2026-02-02T00:00:00.000Z');
const oldest = video('oldest', '2026-01-01T00:00:00.000Z');

describe('playback queue helpers', () => {
	it('sorts newest first and oldest first', () => {
		expect(sortQueue([oldest, newest, middle], 'newest').map((item) => item.title)).toEqual([
			'newest',
			'middle',
			'oldest'
		]);
		expect(sortQueue([newest, oldest, middle], 'oldest').map((item) => item.title)).toEqual([
			'oldest',
			'middle',
			'newest'
		]);
	});

	it('skips known-unavailable videos when requested', () => {
		const queue = [newest, { ...middle, availabilityStatus: 'unavailable' as const }, oldest];
		expect(firstEligibleIndex(queue, true)).toBe(0);
		expect(
			firstEligibleIndex([{ ...newest, availabilityStatus: 'unavailable' }, oldest], true)
		).toBe(1);
		expect(
			firstEligibleIndex([{ ...newest, availabilityStatus: 'unavailable' }, oldest], false)
		).toBe(0);
	});

	it('finds the next eligible video', () => {
		const queue = [newest, { ...middle, availabilityStatus: 'unavailable' as const }, oldest];
		expect(nextEligibleIndex(queue, 0, { skipUnavailable: true, loop: false })).toBe(2);
		expect(nextEligibleIndex(queue, 1, { skipUnavailable: true, loop: false })).toBe(2);
		expect(nextEligibleIndex(queue, 2, { skipUnavailable: true, loop: false })).toBeNull();
	});

	it('wraps to the start when looping', () => {
		expect(
			nextEligibleIndex([newest, middle, oldest], 2, { skipUnavailable: true, loop: true })
		).toBe(0);
	});

	it('does not loop unavailable videos', () => {
		const queue = [{ ...newest, availabilityStatus: 'unavailable' as const }, oldest];
		expect(nextEligibleIndex(queue, 1, { skipUnavailable: true, loop: true })).toBe(1);
	});
});
