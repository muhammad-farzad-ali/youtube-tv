import { browser } from '$app/env';
import { catalog } from './catalog.svelte';
import { profile } from './profile.svelte';
import { seedCatalogVideos, getVideosForChannel } from '#lib/storage/database';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

class AppStore {
	status = $state<AppStatus>('idle');
	error = $state<string | null>(null);
	private pending: Promise<void> | null = null;

	async initialize(): Promise<void> {
		if (!browser || this.status === 'ready') return;
		if (this.pending) return this.pending;

		this.status = 'loading';
		this.error = null;

		this.pending = (async () => {
			try {
				await catalog.load();
				if (!catalog.data || catalog.status !== 'ready') {
					throw new Error(catalog.error ?? 'The channel catalog could not be loaded');
				}
				profile.initialize();
				await seedCatalogVideos(
					catalog.data,
					profile.lineup.map((entry) => entry.channelId)
				);
				this.status = 'ready';
			} catch (cause) {
				this.error = cause instanceof Error ? cause.message : 'The app could not start';
				this.status = 'error';
			} finally {
				this.pending = null;
			}
		})();

		return this.pending;
	}

	async retry(): Promise<void> {
		this.status = 'idle';
		await catalog.load(true);
		await this.initialize();
	}

	async ensureChannelVideos(channelId: string): Promise<void> {
		if (!catalog.data) return;
		const existing = await getVideosForChannel(channelId);
		if (existing.length > 0) return;
		await seedCatalogVideos(catalog.data, [channelId]);
	}
}

export const app = new AppStore();
