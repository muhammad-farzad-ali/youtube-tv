import { describe, expect, it } from 'vitest';
import { formatBytes, formatTime, initials, safeFileName } from '#lib/utils/format';

describe('format helpers', () => {
	it('formats durations', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(65)).toBe('1:05');
		expect(formatTime(3661)).toBe('1:01:01');
		expect(formatTime(null)).toBe('--:--');
	});

	it('formats bytes', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(2048)).toBe('2.0 KB');
		expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
		expect(formatBytes(null)).toBe('—');
	});

	it('builds initials and safe filenames', () => {
		expect(initials('Google for Developers')).toBe('GF');
		expect(safeFileName('Cable TV Backup 2026')).toBe('cable-tv-backup-2026');
	});
});
