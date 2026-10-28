import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	FeedError,
	fetchChannelFeed,
	parseYouTubeFeed,
	validateProxyUrl
} from '#lib/services/rssClient';

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <id>yt:channel:_x5XG1OV2P6uZZ5FSM9Ttw</id>
  <yt:channelId>UC_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId>
  <title>Google for Developers</title>
  <entry>
    <id>yt:video:AAAAAAAAAAA</id>
    <yt:videoId>AAAAAAAAAAA</yt:videoId>
    <title>Older video</title>
    <published>2026-10-20T10:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg" width="480" height="360" />
    </media:group>
  </entry>
  <entry>
    <id>yt:video:BBBBBBBBBBB</id>
    <yt:videoId>BBBBBBBBBBB</yt:videoId>
    <title>Newer video</title>
    <published>2026-10-27T10:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/BBBBBBBBBBB/hqdefault.jpg" width="480" height="360" />
    </media:group>
  </entry>
</feed>`;

describe('YouTube feed parser', () => {
	it('parses and sorts entries newest first', () => {
		const result = parseYouTubeFeed(feed, 'UC_x5XG1OV2P6uZZ5FSM9Ttw');
		expect(result.channelTitle).toBe('Google for Developers');
		expect(result.videos).toHaveLength(2);
		expect(result.videos.map((video) => video.videoId)).toEqual(['BBBBBBBBBBB', 'AAAAAAAAAAA']);
		expect(result.videos[0]?.publishedAt).toBe('2026-10-27T10:00:00.000Z');
	});

	it('rejects a feed for another channel', () => {
		expect(() => parseYouTubeFeed(feed, 'UC00000000000000000000')).toThrow(FeedError);
	});

	it('rejects a non-feed response', () => {
		expect(() => parseYouTubeFeed('<html><body>nope</body></html>')).toThrow(FeedError);
	});

	it('requires a usable proxy placeholder', () => {
		expect(validateProxyUrl('')).toBeNull();
		expect(validateProxyUrl('https://proxy.example/?url={url}')).toBeNull();
		expect(validateProxyUrl('https://proxy.example/fetch?u={rawurl}')).toBeNull();
		expect(validateProxyUrl('https://proxy.example/feed?')).toMatch(/placeholder|valid/i);
		expect(validateProxyUrl('not a url {url}')).toBeTruthy();
		expect(validateProxyUrl('http://proxy.example/?url={url}')).toMatch(/https/i);
	});
});

describe('feed transport', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('uses the direct feed when the browser allows it', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(feed, { status: 200, headers: { 'content-type': 'application/xml' } })
			)
		);
		const result = await fetchChannelFeed('UC_x5XG1OV2P6uZZ5FSM9Ttw');
		expect(result.via).toBe('direct');
		expect(result.videos).toHaveLength(2);
	});

	it('falls back to the configured proxy when direct fetch is CORS-blocked', async () => {
		const calls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: string | URL) => {
				const url = String(input);
				calls.push(url);
				if (url.startsWith('https://proxy.example/')) {
					return new Response(feed, {
						status: 200,
						headers: { 'content-type': 'application/xml' }
					});
				}
				throw new TypeError('NetworkError when attempting to fetch resource.');
			})
		);
		const result = await fetchChannelFeed(
			'UC_x5XG1OV2P6uZZ5FSM9Ttw',
			'https://proxy.example/?url={url}'
		);
		expect(result.via).toBe('proxy');
		expect(calls[0]).toContain('proxy.example');
		expect(calls[0]).toContain(encodeURIComponent('UC_x5XG1OV2P6uZZ5FSM9Ttw'));
	});
});
