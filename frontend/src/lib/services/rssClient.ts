import type { CatalogVideo } from '#lib/schemas/catalog.schema';

export type FeedErrorCode = 'cors' | 'network' | 'http' | 'parse' | 'empty' | 'proxy';

export class FeedError extends Error {
	code: FeedErrorCode;
	constructor(code: FeedErrorCode, message: string) {
		super(message);
		this.name = 'FeedError';
		this.code = code;
	}
}

export function buildFeedUrl(channelId: string): string {
	return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

function textOf(element: Element | null | undefined): string {
	return element?.textContent?.trim() ?? '';
}

function firstTag(parent: Element, tag: string, namespace?: string): Element | null {
	const direct = parent.getElementsByTagName(tag)[0];
	if (direct) return direct;
	if (namespace) return parent.getElementsByTagNameNS(namespace, tag.split(':').pop() ?? tag)[0] ?? null;
	return null;
}

export function parseYouTubeFeed(xml: string, expectedChannelId?: string): {
	channelTitle: string;
	videos: CatalogVideo[];
} {
	const parser = new DOMParser();
	const document = parser.parseFromString(xml, 'application/xml');
	const parserError = document.querySelector('parsererror');
	if (parserError) {
		throw new FeedError('parse', 'The feed is not valid XML.');
	}

	const feed = document.documentElement;
	if (!feed || feed.localName !== 'feed') {
		throw new FeedError('parse', 'The response is not a YouTube Atom feed.');
	}

	const feedChannelId =
		textOf(firstTag(feed, 'yt:channelId', 'http://www.youtube.com/xml/schemas/2015')) || '';
	if (expectedChannelId && feedChannelId && feedChannelId !== expectedChannelId) {
		throw new FeedError('parse', 'The feed belongs to a different channel.');
	}

	const entries = Array.from(feed.getElementsByTagName('entry'));
	const seen = new Set<string>();
	const videos: CatalogVideo[] = [];

	for (const entry of entries) {
		const videoId = textOf(firstTag(entry, 'yt:videoId', 'http://www.youtube.com/xml/schemas/2015'));
		const title = textOf(firstTag(entry, 'title'));
		const publishedAt = textOf(firstTag(entry, 'published'));
		const thumbnail =
			firstTag(entry, 'media:thumbnail')?.getAttribute('url') ||
			firstTag(entry, 'media:thumbnail', 'http://search.yahoo.com/mrss/')?.getAttribute('url') ||
			'';

		if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) continue;
		if (!title) continue;
		if (!publishedAt || Number.isNaN(Date.parse(publishedAt))) continue;
		if (seen.has(videoId)) continue;
		seen.add(videoId);

		videos.push({
			videoId,
			title,
			thumbnailUrl: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
			publishedAt: new Date(publishedAt).toISOString()
		});
	}

	if (videos.length === 0) {
		throw new FeedError('empty', 'The feed contains no usable videos.');
	}

	videos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
	return {
		channelTitle: textOf(firstTag(feed, 'title')),
		videos: videos.slice(0, 30)
	};
}

function applyProxy(proxyUrl: string, feedUrl: string): string {
	const template = proxyUrl.trim();
	if (template.includes('{url}')) return template.replaceAll('{url}', encodeURIComponent(feedUrl));
	if (template.includes('{rawurl}')) return template.replaceAll('{rawurl}', feedUrl);
	if (template.endsWith('=')) return `${template}${encodeURIComponent(feedUrl)}`;
	throw new FeedError(
		'proxy',
		'The proxy URL must contain a {url} placeholder, for example https://proxy.example/?url={url}'
	);
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { accept: 'application/atom+xml, application/xml, text/xml, */*' }
		});
		if (!response.ok) {
			throw new FeedError('http', `Feed request returned HTTP ${response.status}.`);
		}
		return await response.text();
	} catch (cause) {
		if (cause instanceof FeedError) throw cause;
		if (cause instanceof DOMException && cause.name === 'AbortError') {
			throw new FeedError('network', 'The feed request timed out.');
		}
		throw new FeedError(
			'cors',
			'YouTube blocks direct browser access to its RSS feeds. Add a feed proxy in Settings or use the catalog snapshot.'
		);
	} finally {
		clearTimeout(timer);
	}
}

export async function fetchChannelFeed(
	channelId: string,
	proxyUrl = ''
): Promise<{ channelTitle: string; videos: CatalogVideo[]; via: 'direct' | 'proxy' }> {
	const feedUrl = buildFeedUrl(channelId);
	let directError: FeedError | null = null;

	try {
		const xml = await fetchText(feedUrl);
		const parsed = parseYouTubeFeed(xml, channelId);
		return { ...parsed, via: 'direct' };
	} catch (cause) {
		directError = cause instanceof FeedError ? cause : new FeedError('network', 'Feed request failed.');
	}

	if (proxyUrl.trim()) {
		const proxied = applyProxy(proxyUrl, feedUrl);
		const xml = await fetchText(proxied);
		const parsed = parseYouTubeFeed(xml, channelId);
		return { ...parsed, via: 'proxy' };
	}

	if (directError.code === 'cors') {
		throw new FeedError(
			'cors',
			'YouTube blocks direct browser access to RSS feeds (CORS). Add an optional feed proxy in Settings, or rely on the bundled catalog snapshot.'
		);
	}
	throw directError;
}

export async function testFeedProxy(
	proxyUrl: string
): Promise<{ channelTitle: string; videoCount: number }> {
	const channelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
	const feedUrl = buildFeedUrl(channelId);
	const xml = await fetchText(applyProxy(proxyUrl, feedUrl), 15_000);
	const parsed = parseYouTubeFeed(xml, channelId);
	return { channelTitle: parsed.channelTitle, videoCount: parsed.videos.length };
}

export function validateProxyUrl(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (!trimmed.includes('{url}') && !trimmed.includes('{rawurl}') && !trimmed.endsWith('=')) {
		return 'Add a {url} placeholder to the proxy URL.';
	}
	try {
		const url = new URL(trimmed.replaceAll('{url}', 'https://example.com').replaceAll('{rawurl}', 'https://example.com'));
		if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
			return 'Use an https:// proxy URL.';
		}
		return null;
	} catch {
		return 'The proxy URL is not valid.';
	}
}
