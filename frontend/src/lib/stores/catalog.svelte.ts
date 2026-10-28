import { asset } from '$app/paths';
import { catalogSchema, type Catalog, type CatalogChannel } from '#lib/schemas/catalog.schema';

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

class CatalogStore {
	status = $state<CatalogStatus>('idle');
	data = $state<Catalog | null>(null);
	error = $state<string | null>(null);

	channels = $derived<CatalogChannel[]>(this.data?.channels ?? []);
	channelsById = $derived(new Map(this.channels.map((channel) => [channel.id, channel])));
	categories = $derived(
		[...new Set(this.channels.map((channel) => channel.category))].sort((a, b) =>
			a.localeCompare(b)
		)
	);

	private pending: Promise<void> | null = null;

	async load(force = false): Promise<void> {
		if (this.status === 'ready' && !force) return;
		if (this.pending) return this.pending;

		this.status = this.data ? 'ready' : 'loading';
		this.error = null;

		this.pending = (async () => {
			try {
				const response = await fetch(asset('catalog.json' as never), {
					cache: force ? 'reload' : 'no-cache'
				});
				if (!response.ok) {
					throw new Error(`Catalog request failed with HTTP ${response.status}`);
				}
				const parsed = catalogSchema.safeParse(await response.json());
				if (!parsed.success) {
					const issue = parsed.error.issues[0];
					throw new Error(
						`Catalog is invalid${issue ? `: ${issue.path.join('.')} — ${issue.message}` : ''}`
					);
				}
				this.data = parsed.data;
				this.status = 'ready';
			} catch (cause) {
				this.error = cause instanceof Error ? cause.message : 'Could not load the channel catalog';
				this.status = 'error';
			} finally {
				this.pending = null;
			}
		})();

		return this.pending;
	}

	getChannel(channelId: string): CatalogChannel | undefined {
		return this.channelsById.get(channelId);
	}
}

export const catalog = new CatalogStore();
