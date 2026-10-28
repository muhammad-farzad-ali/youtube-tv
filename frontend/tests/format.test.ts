import { describe, expect, it } from 'vitest';
import { formatDuration, formatTime, initials, youtubeThumbnail } from '#lib/utils/format';

describe('format helpers', () => {
	it('formats durations', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(65)).toBe('1:05');
		expect(formatTime(3661)).toBe('1:01:01');
		expect(formatTime(null)).toBe('--:--');
		expect(formatDuration(0)).toBeNull();
		expect(formatDuration(65)).toBe('1:05');
	});

	it('builds channel initials', () => {
		expect(initials('Google for Developers')).toBe('GF');
		expect(initials('NASA')).toBe('N');
	});

	it('builds YouTube thumbnails', () => {
		expect(youtubeThumbnail('dQw4w9WgXcQ')).toBe(
			'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
		);
		expect(youtubeThumbnail('dQw4w9WgXcQ', 'hq')).toBe(
			'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
		);
	});
});
