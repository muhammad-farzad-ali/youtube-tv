import { XMLParser } from 'fast-xml-parser';

export const UA =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export const DEFAULT_FEED_LIMIT = 15;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	trimValues: true,
	parseTagValue: false
});

export function isValidChannelId(value) {
	return typeof value === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(value);
}

export function isValidVideoId(value) {
	return typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
}

export function feedUrl(channelId) {
	return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

export function canonicalChannelUrl(channelId) {
	return `https://www.youtube.com/channel/${channelId}`;
}

export function oembedUrl(videoId) {
	const target = `https://www.youtube.com/shorts/${videoId}`;
	return `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`;
}

/**
 * Classify a video as a Short or a regular upload using YouTube's public
 * oEmbed endpoint. Shorts report vertical dimensions; regular videos report
 * horizontal dimensions. Returns "unknown" when the video cannot be verified.
 */
export async function classifyVideoOrientation(videoId, attempts = 2) {
	if (!isValidVideoId(videoId)) return 'unknown';

	for (let attempt = 0; attempt < attempts; attempt++) {
		try {
			const response = await fetchWithTimeout(
				oembedUrl(videoId),
				{
					headers: { accept: 'application/json' }
				},
				12_000
			);
			if (!response.ok) {
				if (response.status >= 500 && attempt + 1 < attempts) continue;
				return 'unknown';
			}
			const data = await response.json();
			const width = Number(data?.width);
			const height = Number(data?.height);
			if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
				return height > width ? 'short' : 'long';
			}
			return 'unknown';
		} catch {
			if (attempt + 1 < attempts) continue;
		}
	}
	return 'unknown';
}

export async function fetchWithTimeout(url, options = {}, timeout = 20000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		return await fetch(url, {
			...options,
			signal: controller.signal,
			headers: {
				'user-agent': UA,
				'accept-language': 'en-US,en;q=0.9',
				...options.headers
			}
		});
	} finally {
		clearTimeout(timer);
	}
}

function text(value) {
	if (value == null) return '';
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number') return String(value);
	if (Array.isArray(value)) return text(value[0]);
	if (typeof value === 'object') {
		if ('#text' in value) return text(value['#text']);
	}
	return '';
}

function asArray(value) {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

/**
 * Parse a YouTube Atom feed. The feed-level channelId omits the leading "UC",
 * so consumers should prefer the caller-supplied channel ID as identity.
 */
export function parseYouTubeFeed(xml, limit = DEFAULT_FEED_LIMIT) {
	const parsed = parser.parse(xml);
	const feed = parsed?.feed;
	if (!feed) throw new Error('Feed response was not a YouTube Atom feed');

	const feedTitle = text(feed.title);
	const feedChannelId = text(feed['yt:channelId']);
	const entries = asArray(feed.entry);
	const videos = [];

	for (const entry of entries) {
		const videoId = text(entry?.['yt:videoId']);
		const title = text(entry?.title);
		const publishedAt = text(entry?.published);
		const mediaGroup = entry?.['media:group'];
		const thumbnails = asArray(mediaGroup?.['media:thumbnail']);
		const thumbnailUrl = thumbnails[0]?.['@_url'];

		if (!isValidVideoId(videoId) || !title || !publishedAt) continue;
		if (Number.isNaN(Date.parse(publishedAt))) continue;

		videos.push({
			videoId,
			title: title.slice(0, 500),
			thumbnailUrl: thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
			publishedAt: new Date(publishedAt).toISOString()
		});
	}

	videos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
	const deduped = [];
	const seen = new Set();
	for (const video of videos) {
		if (seen.has(video.videoId)) continue;
		seen.add(video.videoId);
		deduped.push(video);
	}

	return {
		feedTitle,
		feedChannelId,
		videos: deduped.slice(0, Math.max(1, limit))
	};
}

export async function fetchChannelFeed(channelId, limit = DEFAULT_FEED_LIMIT) {
	if (!isValidChannelId(channelId)) throw new Error(`Invalid channel ID: ${channelId}`);
	const response = await fetchWithTimeout(feedUrl(channelId));
	if (!response.ok) throw new Error(`Feed for ${channelId} returned HTTP ${response.status}`);
	const parsed = parseYouTubeFeed(await response.text(), limit);
	if (parsed.videos.length === 0) {
		throw new Error(`No usable videos found for ${channelId}`);
	}
	return parsed;
}

function coerceChannelUrl(input) {
	const value = input.trim();
	if (!value) throw new Error('Enter a channel ID, handle, or YouTube channel URL.');

	if (/^(https?:)?\/\//i.test(value)) return new URL(value);
	if (/^(www\.)?youtube\.com\//i.test(value)) return new URL(`https://${value}`);
	if (value.startsWith('@')) return new URL(`https://www.youtube.com/${value}`);
	if (/^[A-Za-z0-9._-]+$/.test(value)) return new URL(`https://www.youtube.com/@${value}`);
	throw new Error(`Could not understand channel input: ${input}`);
}

/**
 * Resolve a channel ID, @handle, /c/, /user/, or /channel/ URL into a stable
 * channel ID. Handles require one HTML page request; IDs do not.
 */
export async function resolveChannelInput(input) {
	const value = input.trim();
	if (isValidChannelId(value)) {
		return {
			channelId: value,
			channelUrl: canonicalChannelUrl(value),
			resolvedFrom: 'channel-id',
			pageTitle: ''
		};
	}

	const url = coerceChannelUrl(value);
	if (/youtu\.be$/i.test(url.hostname) || url.pathname === '/watch') {
		throw new Error('That is a video URL, not a channel URL. Use the channel page or an @handle.');
	}

	const channelMatch = url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/|$)/);
	if (channelMatch?.[1]) {
		return {
			channelId: channelMatch[1],
			channelUrl: canonicalChannelUrl(channelMatch[1]),
			resolvedFrom: 'channel-url',
			pageTitle: ''
		};
	}

	if (!/^\/(@|c\/|user\/)/.test(url.pathname)) {
		throw new Error(
			'Use a /channel/UC…, /@handle, /c/name, or /user/name URL. Video, playlist, and search URLs are not channels.'
		);
	}

	const pageUrl = `https://www.youtube.com${url.pathname}`;
	const response = await fetchWithTimeout(pageUrl, { headers: { accept: 'text/html' } });
	if (!response.ok) throw new Error(`Channel page returned HTTP ${response.status}: ${pageUrl}`);
	const html = await response.text();

	const externalId =
		html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/)?.[1] ??
		html.match(
			/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/
		)?.[1];

	if (!externalId) {
		throw new Error(
			'Could not resolve that page to a channel ID. Open the channel, copy its /channel/UC… URL, and retry.'
		);
	}

	const pageTitle =
		html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)?.[1] ??
		html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/)?.[1] ??
		'';

	return {
		channelId: externalId,
		channelUrl: canonicalChannelUrl(externalId),
		resolvedFrom: url.pathname,
		pageTitle
	};
}
