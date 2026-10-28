import { browser } from '$app/env';

const STORAGE_KEY = 'cable-tv:preferences:v1';

type SavedPreferences = {
	pinned: string[];
	favorites: string[];
	hidden: string[];
};

function sanitizeIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

class PreferencesStore {
	pinnedIds = $state<string[]>([]);
	favoriteIds = $state<string[]>([]);
	hiddenIds = $state<string[]>([]);
	loaded = $state(false);

	load(): void {
		if (!browser || this.loaded) return;
		this.loaded = true;

		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as Partial<SavedPreferences>;
			this.pinnedIds = sanitizeIds(parsed.pinned);
			this.favoriteIds = sanitizeIds(parsed.favorites);
			this.hiddenIds = sanitizeIds(parsed.hidden);
		} catch {
			// A corrupt or blocked preference store should not stop the dial.
		}
	}

	isPinned(channelId: string): boolean {
		return this.pinnedIds.includes(channelId);
	}

	isFavorite(channelId: string): boolean {
		return this.favoriteIds.includes(channelId);
	}

	isHidden(channelId: string): boolean {
		return this.hiddenIds.includes(channelId);
	}

	togglePin(channelId: string): void {
		this.pinnedIds = this.isPinned(channelId)
			? this.pinnedIds.filter((id) => id !== channelId)
			: [...this.pinnedIds, channelId];
		this.save();
	}

	toggleFavorite(channelId: string): void {
		this.favoriteIds = this.isFavorite(channelId)
			? this.favoriteIds.filter((id) => id !== channelId)
			: [...this.favoriteIds, channelId];
		this.save();
	}

	toggleHidden(channelId: string): void {
		this.hiddenIds = this.isHidden(channelId)
			? this.hiddenIds.filter((id) => id !== channelId)
			: [...this.hiddenIds, channelId];
		this.save();
	}

	private save(): void {
		if (!browser) return;
		try {
			const saved: SavedPreferences = {
				pinned: this.pinnedIds,
				favorites: this.favoriteIds,
				hidden: this.hiddenIds
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
		} catch {
			// Keep the in-memory state when storage is unavailable.
		}
	}
}

export const preferences = new PreferencesStore();
