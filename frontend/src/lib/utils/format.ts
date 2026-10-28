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

export function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return 'Never';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return 'Never';
	return new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
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

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || !Number.isFinite(bytes)) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index++;
	}
	return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
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

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return count === 1 ? singular : plural;
}

export function categoryTone(category: string): string {
	const normalized = category.toLowerCase();
	if (normalized.includes('tech')) return 'text-blue border-blue/30 bg-blue/10';
	if (normalized.includes('sci')) return 'text-cyan border-cyan/30 bg-cyan/10';
	if (normalized.includes('news')) return 'text-red border-red/30 bg-red/10';
	if (normalized.includes('gam')) return 'text-magenta border-magenta/30 bg-magenta/10';
	if (normalized.includes('learn') || normalized.includes('edu'))
		return 'text-green border-green/30 bg-green/10';
	return 'text-yellow border-yellow/30 bg-yellow/10';
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

export function safeFileName(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}
