import Dexie, { type Table } from 'dexie';
import { browser } from '$app/env';
import type { Catalog, CatalogVideo } from '#lib/schemas/catalog.schema';

export type AvailabilityStatus = 'unknown' | 'available' | 'unavailable';
export type VideoSource = 'snapshot' | 'feed' | 'player';

export interface VideoRecord {
	videoId: string;
	channelId: string;
	title: string;
	thumbnailUrl?: string;
	publishedAt: string;
	durationSeconds?: number | null;
	availabilityStatus: AvailabilityStatus;
	lastCheckedAt?: string | null;
	source: VideoSource;
	addedAt: string;
}

export interface SyncRecord {
	channelId: string;
	status: 'ok' | 'error';
	lastAttemptAt: string;
	lastSyncedAt?: string;
	error?: string;
	via?: 'direct' | 'proxy';
	videoCount?: number;
}

export interface MetaRecord {
	key: string;
	value: string;
}

class CableTvDatabase extends Dexie {
	videos!: Table<VideoRecord, string>;
	sync!: Table<SyncRecord, string>;
	meta!: Table<MetaRecord, string>;

	constructor() {
		super('cable-tv');
		this.version(1).stores({
			videos: 'videoId, channelId, publishedAt, [channelId+publishedAt]',
			sync: 'channelId',
			meta: 'key'
		});
	}
}

let instance: CableTvDatabase | null = null;

export function getDb(): CableTvDatabase {
	if (!browser) {
		throw new Error('IndexedDB is only available in the browser');
	}
	instance ??= new CableTvDatabase();
	return instance;
}

export async function getMeta(key: string): Promise<string | null> {
	const row = await getDb().meta.get(key);
	return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
	await getDb().meta.put({ key, value });
}

export async function getVideosForChannel(channelId: string): Promise<VideoRecord[]> {
	return getDb()
		.videos.where('channelId')
		.equals(channelId)
		.toArray()
		.then((videos) => videos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)));
}

export async function getAllVideoCounts(): Promise<Record<string, number>> {
	const rows = await getDb().videos.toArray();
	const counts: Record<string, number> = {};
	for (const row of rows) {
		counts[row.channelId] = (counts[row.channelId] ?? 0) + 1;
	}
	return counts;
}

export async function getTotalVideoCount(): Promise<number> {
	return getDb().videos.count();
}

export async function seedCatalogVideos(
	catalog: Catalog,
	channelIds?: string[]
): Promise<number> {
	const wanted = new Set(channelIds ?? catalog.channels.map((channel) => channel.id));
	const channels = catalog.channels.filter((channel) => wanted.has(channel.id));
	const allVideos = channels.flatMap((channel) =>
		channel.videos.map((video) => ({ channel, video }))
	);
	if (allVideos.length === 0) return 0;

	const existing = await getDb().videos.bulkGet(allVideos.map(({ video }) => video.videoId));
	const existingById = new Map(existing.filter(Boolean).map((row) => [row!.videoId, row!]));
	const now = new Date().toISOString();
	const records: VideoRecord[] = [];

	for (const { channel, video } of allVideos) {
		const current = existingById.get(video.videoId);
		records.push({
			videoId: video.videoId,
			channelId: channel.id,
			title: video.title,
			thumbnailUrl: video.thumbnailUrl,
			publishedAt: video.publishedAt,
			durationSeconds: current?.durationSeconds ?? video.durationSeconds ?? null,
			availabilityStatus: current?.availabilityStatus ?? 'unknown',
			lastCheckedAt: current?.lastCheckedAt ?? null,
			source: current?.source ?? 'snapshot',
			addedAt: current?.addedAt ?? now
		});
	}

	await getDb().videos.bulkPut(records);
	await setMeta('catalogUpdatedAt', catalog.updatedAt);
	return records.length;
}

export async function saveFeedVideos(
	channelId: string,
	videos: CatalogVideo[],
	via: 'direct' | 'proxy'
): Promise<{ added: number; updated: number }> {
	const db = getDb();
	const existing = await db.videos.bulkGet(videos.map((video) => video.videoId));
	const existingById = new Map(existing.filter(Boolean).map((row) => [row!.videoId, row!]));
	const now = new Date().toISOString();
	const records: VideoRecord[] = [];
	let added = 0;
	let updated = 0;

	for (const video of videos) {
		const current = existingById.get(video.videoId);
		if (current) updated++;
		else added++;
		records.push({
			videoId: video.videoId,
			channelId,
			title: video.title,
			thumbnailUrl: video.thumbnailUrl,
			publishedAt: video.publishedAt,
			durationSeconds: current?.durationSeconds ?? video.durationSeconds ?? null,
			availabilityStatus: current?.availabilityStatus ?? 'unknown',
			lastCheckedAt: current?.lastCheckedAt ?? null,
			source: current?.source === 'player' ? current.source : 'feed',
			addedAt: current?.addedAt ?? now
		});
	}

	await db.videos.bulkPut(records);
	await db.sync.put({
		channelId,
		status: 'ok',
		lastAttemptAt: now,
		lastSyncedAt: now,
		via,
		videoCount: videos.length
	});
	return { added, updated };
}

export async function recordSyncError(channelId: string, error: string): Promise<void> {
	const now = new Date().toISOString();
	const current = await getDb().sync.get(channelId);
	await getDb().sync.put({
		channelId,
		status: 'error',
		lastAttemptAt: now,
		lastSyncedAt: current?.lastSyncedAt,
		error,
		via: current?.via,
		videoCount: current?.videoCount
	});
}

export async function getSyncRecords(): Promise<Record<string, SyncRecord>> {
	const rows = await getDb().sync.toArray();
	return Object.fromEntries(rows.map((row) => [row.channelId, row]));
}

export async function setVideoAvailability(
	videoId: string,
	status: AvailabilityStatus
): Promise<void> {
	await getDb().videos.update(videoId, {
		availabilityStatus: status,
		lastCheckedAt: new Date().toISOString()
	});
}

export async function setVideoDuration(videoId: string, durationSeconds: number): Promise<void> {
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
	await getDb().videos.update(videoId, { durationSeconds });
}

export async function clearVideos(): Promise<void> {
	await getDb().videos.clear();
}

export async function deleteChannelVideos(channelId: string): Promise<void> {
	await getDb().videos.where('channelId').equals(channelId).delete();
	await getDb().sync.delete(channelId);
}

export async function deleteAllData(): Promise<void> {
	const db = getDb();
	await db.transaction('rw', db.videos, db.sync, db.meta, async () => {
		await db.videos.clear();
		await db.sync.clear();
		await db.meta.clear();
	});
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
	if (!browser || !navigator.storage?.estimate) return null;
	const estimate = await navigator.storage.estimate();
	return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}

