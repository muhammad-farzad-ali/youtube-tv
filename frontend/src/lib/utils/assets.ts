import { asset } from '$app/paths';

export function resolveAsset(path: string | null | undefined): string | undefined {
	if (!path) return undefined;
	if (/^(https?:|data:|blob:)/.test(path)) return path;
	const clean = path.replace(/^\/+/, '');
	// SvelteKit types asset paths from the static directory, but catalog files are data-driven.
	return asset(clean as never);
}

export function channelLogo(channel: { logoUrl?: string }): string | undefined {
	return resolveAsset(channel.logoUrl);
}
