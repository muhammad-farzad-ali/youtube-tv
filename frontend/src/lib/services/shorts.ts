import { applyProxyTemplate } from './rssClient';
import type { ShortClassification } from '#lib/features/feeds/shorts-filter';

export function oembedTarget(videoId: string): string {
	const shortUrl = `https://www.youtube.com/shorts/${videoId}`;
	return `https://www.youtube.com/oembed?url=${encodeURIComponent(shortUrl)}&format=json`;
}

export function classificationFromOembed(data: unknown): ShortClassification {
	if (!data || typeof data !== 'object') return 'unknown';
	const width = Number((data as { width?: unknown }).width);
	const height = Number((data as { height?: unknown }).height);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return 'unknown';
	}
	return height > width ? 'short' : 'long';
}

/**
 * Classify a video through the user's feed proxy. Direct oEmbed is blocked by
 * CORS in browsers, so live refresh must use the proxy for strict filtering.
 */
export async function classifyVideoViaProxy(
	videoId: string,
	proxyUrl: string
): Promise<ShortClassification> {
	if (!proxyUrl.trim()) return 'unknown';

	let url: string;
	try {
		url = applyProxyTemplate(proxyUrl, oembedTarget(videoId));
	} catch {
		return 'unknown';
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 12_000);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { accept: 'application/json' }
		});
		if (!response.ok) return 'unknown';
		return classificationFromOembed(await response.json());
	} catch {
		return 'unknown';
	} finally {
		clearTimeout(timer);
	}
}
