export function formatDate(iso: string | null | undefined): string {
	if (!iso) return 'Unknown date';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return 'Unknown date';
	return new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(date);
}

export function formatRelative(iso: string | null | undefined): string {
	if (!iso) return 'Never';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return 'Never';
	const diff = date.getTime() - Date.now();
	const abs = Math.abs(diff);
	const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
		['year', 31_536_000_000],
		['month', 2_592_000_000],
		['week', 604_800_000],
		['day', 86_400_000],
		['hour', 3_600_000],
		['minute', 60_000],
		['second', 1000]
	];
	const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	for (const [unit, ms] of units) {
		if (abs >= ms || unit === 'second') {
			return formatter.format(Math.round(diff / ms), unit);
		}
	}
	return 'just now';
}

export function formatTime(seconds: number | null | undefined): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '--:--';
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(seconds: number | null | undefined): string | null {
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
	return formatTime(seconds);
}

export function formatClock(date = new Date()): string {
	return new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: false
	}).format(date);
}

export function youtubeThumbnail(videoId: string, quality: 'hq' | 'mq' = 'mq'): string {
	return `https://i.ytimg.com/vi/${videoId}/${quality}default.jpg`;
}

export function initials(name: string): string {
	return name
		.replace(/[^\p{L}\p{N} ]/gu, '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('');
}

export function hashCode(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (hash << 5) - hash + value.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}
