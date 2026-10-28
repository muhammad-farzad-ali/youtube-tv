import {
	localProfileSchema,
	profileFileSchema,
	type LineupEntry,
	type LocalProfile,
	type ProfileFile
} from '#lib/schemas/profile.schema';
import {
	defaultSettings,
	mergeSettings,
	settingsSchema,
	type Settings
} from '#lib/schemas/settings.schema';
import type { CatalogPack } from '#lib/schemas/catalog.schema';
import { catalog } from './catalog.svelte';

const STORAGE_KEY = 'cable-tv:profile:v1';

type ImportMode = 'merge' | 'replace';

class ProfileStore {
	initialized = $state(false);
	lineup = $state<LineupEntry[]>([]);
	settings = $state<Settings>(defaultSettings());
	storageError = $state<string | null>(null);
	lastSavedAt = $state<number | null>(null);

	selectedChannels = $derived(
		this.lineup
			.map((entry) => catalog.channelsById.get(entry.channelId))
			.filter((channel) => channel !== undefined)
	);
	channelNumbers = $derived(
		new Map(this.selectedChannels.map((channel, index) => [channel.id, this.settings.numberStart + index]))
	);
	favorites = $derived(new Set(this.lineup.filter((entry) => entry.favorite).map((entry) => entry.channelId)));
	selectedChannelId = $derived.by(() => {
		const selected = this.settings.selectedChannelId;
		if (selected && this.lineup.some((entry) => entry.channelId === selected)) return selected;
		return this.lineup[0]?.channelId ?? null;
	});
	selectedChannel = $derived(
		this.selectedChannelId ? (catalog.channelsById.get(this.selectedChannelId) ?? null) : null
	);

	initialize(): void {
		if (this.initialized) return;

		const stored = this.read();
		if (stored) {
			const known = new Set(catalog.channels.map((channel) => channel.id));
			this.lineup = stored.lineup.filter((entry) => known.has(entry.channelId));
			this.settings = stored.settings;
			this.initialized = true;
			this.normalizeSelection();
			this.save();
			return;
		}

		this.restoreStarter();
		this.initialized = true;
	}

	private read(): LocalProfile | null {
		if (typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed = localProfileSchema.safeParse(JSON.parse(raw));
			if (!parsed.success) {
				console.warn('Stored profile is invalid; starting from the starter lineup.', parsed.error);
				return null;
			}
			return parsed.data;
		} catch (cause) {
			console.warn('Could not read stored profile', cause);
			return null;
		}
	}

	restoreStarter(): void {
		const ids = catalog.starterChannelIds.length
			? catalog.starterChannelIds
			: catalog.channels.slice(0, 12).map((channel) => channel.id);
		this.lineup = ids.map((channelId) => ({ channelId, favorite: false }));
		this.settings = {
			...this.settings,
			selectedChannelId: this.lineup[0]?.channelId ?? null
		};
		this.normalizeSelection();
		this.save();
	}

	resetProfile(): void {
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.removeItem(STORAGE_KEY);
			} catch {
				// Storage can be unavailable in private modes.
			}
		}
		this.initialized = false;
		this.lineup = [];
		this.settings = defaultSettings();
		this.restoreStarter();
		this.initialized = true;
	}

	normalizeSelection(): void {
		const known = new Set(catalog.channels.map((channel) => channel.id));
		this.lineup = this.lineup.filter((entry) => known.has(entry.channelId));
		if (
			this.settings.selectedChannelId &&
			!this.lineup.some((entry) => entry.channelId === this.settings.selectedChannelId)
		) {
			this.settings.selectedChannelId = this.lineup[0]?.channelId ?? null;
		}
		if (!this.settings.selectedChannelId) {
			this.settings.selectedChannelId = this.lineup[0]?.channelId ?? null;
		}
	}

	isSelected(channelId: string): boolean {
		return this.lineup.some((entry) => entry.channelId === channelId);
	}

	isFavorite(channelId: string): boolean {
		return this.lineup.some((entry) => entry.channelId === channelId && entry.favorite);
	}

	toggleChannel(channelId: string): boolean {
		if (!catalog.channelsById.has(channelId)) return false;
		if (this.isSelected(channelId)) {
			this.removeChannel(channelId);
			return false;
		}
		this.lineup = [...this.lineup, { channelId, favorite: false }];
		if (!this.settings.selectedChannelId) this.settings.selectedChannelId = channelId;
		this.save();
		return true;
	}

	removeChannel(channelId: string): void {
		this.lineup = this.lineup.filter((entry) => entry.channelId !== channelId);
		if (this.settings.selectedChannelId === channelId) {
			this.settings.selectedChannelId = this.lineup[0]?.channelId ?? null;
		}
		this.save();
	}

	toggleFavorite(channelId: string): void {
		this.lineup = this.lineup.map((entry) =>
			entry.channelId === channelId ? { ...entry, favorite: !entry.favorite } : entry
		);
		this.save();
	}

	move(channelId: string, delta: number): void {
		const index = this.lineup.findIndex((entry) => entry.channelId === channelId);
		const target = index + delta;
		if (index < 0 || target < 0 || target >= this.lineup.length) return;
		this.reorder(index, target);
	}

	reorder(from: number, to: number): void {
		if (from === to || from < 0 || to < 0 || from >= this.lineup.length || to >= this.lineup.length) {
			return;
		}
		const next = [...this.lineup];
		const [item] = next.splice(from, 1);
		if (!item) return;
		next.splice(to, 0, item);
		this.lineup = next;
		this.save();
	}

	applyPack(pack: CatalogPack, mode: ImportMode): void {
		const favorites = new Map(this.lineup.map((entry) => [entry.channelId, entry.favorite]));
		if (mode === 'replace') {
			this.lineup = pack.channelIds.map((channelId) => ({
				channelId,
				favorite: favorites.get(channelId) ?? false
			}));
		} else {
			const existing = new Set(this.lineup.map((entry) => entry.channelId));
			this.lineup = [
				...this.lineup,
				...pack.channelIds
					.filter((channelId) => !existing.has(channelId))
					.map((channelId) => ({ channelId, favorite: favorites.get(channelId) ?? false }))
			];
		}
		this.normalizeSelection();
		this.save();
	}

	selectChannel(channelId: string): boolean {
		if (!this.lineup.some((entry) => entry.channelId === channelId)) return false;
		this.settings = { ...this.settings, selectedChannelId: channelId };
		this.save();
		return true;
	}

	setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
		const next = settingsSchema.safeParse({ ...this.settings, [key]: value });
		if (!next.success) {
			console.warn(`Invalid setting ${String(key)}`, next.error);
			return;
		}
		this.settings = next.data;
		this.save();
	}

	recordLastPlayed(channelId: string, videoId: string): void {
		this.settings = {
			...this.settings,
			lastPlayed: { ...this.settings.lastPlayed, [channelId]: videoId }
		};
		this.save();
	}

	save(): void {
		if (typeof localStorage === 'undefined') return;
		try {
			const payload: LocalProfile = {
				schemaVersion: 1,
				name: 'My Cable TV',
				lineup: this.lineup,
				settings: this.settings
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
			this.lastSavedAt = Date.now();
			this.storageError = null;
		} catch (cause) {
			this.storageError =
				cause instanceof Error ? cause.message : 'Could not save your lineup in this browser';
		}
	}

	exportFile(kind: 'full' | 'lineup' | 'settings' = 'full'): ProfileFile {
		return profileFileSchema.parse({
			schemaVersion: 1,
			type: 'cable-tv-profile',
			name: 'My Cable TV',
			exportedAt: new Date().toISOString(),
			lineup: kind === 'settings' ? [] : this.lineup,
			settings: kind === 'lineup' ? null : this.settings
		});
	}

	applyImportedProfile(
		profile: ProfileFile,
		mode: ImportMode,
		options: { applySettings: boolean; skipUnknown: boolean }
	): { added: number; removed: number; unknown: string[] } {
		const known = new Set(catalog.channels.map((channel) => channel.id));
		const unknown: string[] = [];
		const incoming: LineupEntry[] = [];
		const seen = new Set<string>();

		for (const entry of profile.lineup) {
			if (!known.has(entry.channelId)) {
				unknown.push(entry.channelId);
				continue;
			}
			if (seen.has(entry.channelId)) continue;
			seen.add(entry.channelId);
			incoming.push({ channelId: entry.channelId, favorite: entry.favorite });
		}

		if (!options.skipUnknown && unknown.length > 0) {
			return { added: 0, removed: 0, unknown };
		}

		const previous = new Set(this.lineup.map((entry) => entry.channelId));
		const next = new Set(incoming.map((entry) => entry.channelId));

		if (mode === 'replace') {
			this.lineup = incoming;
		} else {
			const existing = new Map(this.lineup.map((entry) => [entry.channelId, entry]));
			this.lineup = [
				...this.lineup,
				...incoming
					.filter((entry) => !existing.has(entry.channelId))
					.map((entry) => ({ channelId: entry.channelId, favorite: entry.favorite }))
			];
			for (const entry of incoming) {
				const current = existing.get(entry.channelId);
				if (current && entry.favorite !== current.favorite) {
					current.favorite = entry.favorite;
				}
			}
		}

		if (options.applySettings && profile.settings) {
			this.settings = mergeSettings({ ...profile.settings, selectedChannelId: this.settings.selectedChannelId });
		}

		this.normalizeSelection();
		this.save();

		return {
			added: [...next].filter((channelId) => !previous.has(channelId)).length,
			removed: mode === 'replace' ? [...previous].filter((channelId) => !next.has(channelId)).length : 0,
			unknown
		};
	}
}

export const profile = new ProfileStore();
