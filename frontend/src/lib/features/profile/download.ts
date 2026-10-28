import type { ProfileFile } from '#lib/schemas/profile.schema';
import { safeFileName } from '#lib/utils/format';

export function downloadJson(data: unknown, filename: string): void {
	const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
		type: 'application/json;charset=utf-8'
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadProfile(profile: ProfileFile, kind: 'full' | 'lineup' | 'settings'): string {
	const date = new Date().toISOString().slice(0, 10);
	const suffix = kind === 'full' ? 'profile' : kind;
	const filename = `cable-tv-${safeFileName(suffix)}-${date}.json`;
	downloadJson(profile, filename);
	return filename;
}
