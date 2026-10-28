<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Search,
		ChevronUp,
		ChevronDown,
		SlidersHorizontal,
		X,
		Pin,
		Star,
		Eye,
		EyeOff
	} from '@lucide/svelte';
	import ChannelLogo from '#lib/components/ChannelLogo.svelte';
	import type { CatalogChannel } from '#lib/schemas/catalog.schema';
	import type { PlaybackStatus } from '#lib/stores/playback.svelte';
	import { preferences } from '#lib/stores/preferences.svelte';

	interface Props {
		channels: CatalogChannel[];
		selectedChannelId: string | null;
		playingChannelId: string | null;
		playingStatus: PlaybackStatus;
		mobileOpen: boolean;
		onselect: (channelId: string) => void;
		onprevious: () => void;
		onnext: () => void;
		onclosemobile: () => void;
	}

	let {
		channels,
		selectedChannelId,
		playingChannelId,
		playingStatus,
		mobileOpen,
		onselect,
		onprevious,
		onnext,
		onclosemobile
	}: Props = $props();

	let search = $state('');
	let category = $state('All');
	let searchInput: HTMLInputElement | null = $state(null);
	let desktop = $state(false);

	onMount(() => {
		const media = window.matchMedia('(min-width: 1024px)');
		desktop = media.matches;
		const update = () => (desktop = media.matches);
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	const categories = $derived([
		'All',
		'Favorites',
		'Hidden',
		...new Set(channels.map((channel) => channel.category))
	]);
	const numbers = $derived(new Map(channels.map((channel, index) => [channel.id, index + 1])));
	const favoriteCount = $derived(
		channels.filter(
			(channel) => preferences.isFavorite(channel.id) && !preferences.isHidden(channel.id)
		).length
	);
	const hiddenCount = $derived(
		channels.filter((channel) => preferences.isHidden(channel.id)).length
	);
	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return channels.filter((channel) => {
			const hidden = preferences.isHidden(channel.id);
			if (category === 'Hidden') {
				if (!hidden) return false;
			} else if (hidden) {
				return false;
			}
			if (category === 'Favorites' && !preferences.isFavorite(channel.id)) return false;
			if (
				category !== 'All' &&
				category !== 'Favorites' &&
				category !== 'Hidden' &&
				channel.category !== category
			) {
				return false;
			}
			if (!query) return true;
			return (
				channel.name.toLowerCase().includes(query) || channel.category.toLowerCase().includes(query)
			);
		});
	});
	const pinned = $derived(
		category === 'Hidden' ? [] : filtered.filter((channel) => preferences.isPinned(channel.id))
	);
	const unpinned = $derived(
		category === 'Hidden'
			? filtered
			: filtered.filter((channel) => !preferences.isPinned(channel.id))
	);

	function choose(channelId: string) {
		onselect(channelId);
		onclosemobile();
	}

	function isPlaying(channelId: string) {
		return (
			playingChannelId === channelId &&
			(playingStatus === 'playing' || playingStatus === 'loading' || playingStatus === 'paused')
		);
	}

	function emptyMessage() {
		if (category === 'Favorites') return 'No favorite channels yet.';
		if (category === 'Hidden') return 'No hidden channels. Use the eye icon to hide one.';
		return 'No channels match.';
	}
</script>

{#snippet channelRow(channel: CatalogChannel)}
	{@const active = selectedChannelId === channel.id}
	{@const isPinned = preferences.isPinned(channel.id)}
	{@const isFavorite = preferences.isFavorite(channel.id)}
	{@const isHidden = preferences.isHidden(channel.id)}
	<div
		data-testid="channel-row"
		data-channel-id={channel.id}
		class="group mb-0.5 rounded-md border border-transparent transition-colors {active
			? 'tuned-glow border-line bg-raised text-fg'
			: 'text-dim hover:border-line/60 hover:bg-raised/60 hover:text-fg'}"
	>
		<button
			type="button"
			class="flex w-full min-w-0 items-center gap-2 px-2 pt-2 pb-1 text-left"
			aria-current={active ? 'true' : undefined}
			onclick={() => choose(channel.id)}
		>
			<span class="w-7 shrink-0 text-right font-mono text-[10px] text-yellow tabular">
				{String(numbers.get(channel.id) ?? 0).padStart(2, '0')}
			</span>
			<ChannelLogo {channel} size="sm" />
			<span class="min-w-0 flex-1">
				<span class="block truncate text-xs font-medium">{channel.name}</span>
				<span class="mt-0.5 flex items-center gap-1.5">
					<span class="truncate font-mono text-[9px] tracking-wide text-comment uppercase">
						{channel.category}
					</span>
					{#if isPlaying(channel.id)}
						<span
							class="flex items-center gap-1 font-mono text-[8px] tracking-[0.16em] uppercase {playingStatus ===
							'paused'
								? 'text-yellow'
								: 'text-red'}"
						>
							<span
								class="size-1 rounded-full {playingStatus === 'paused'
									? 'bg-yellow'
									: 'bg-red'} {playingStatus === 'playing' ? 'animate-pulse-dot' : ''}"
							></span>
							{playingStatus === 'loading'
								? 'Tuning'
								: playingStatus === 'paused'
									? 'Paused'
									: 'Playing'}
						</span>
					{/if}
				</span>
			</span>
		</button>
		<div class="flex items-center gap-0.5 pb-1.5 pl-20 pr-2">
			<button
				type="button"
				class="btn-icon !size-6 {isPinned ? 'text-cyan' : 'text-comment/70 hover:text-cyan'}"
				aria-label={isPinned ? `Unpin ${channel.name}` : `Pin ${channel.name}`}
				aria-pressed={isPinned}
				title={isPinned ? 'Unpin from the top' : 'Pin to the top'}
				onclick={() => preferences.togglePin(channel.id)}
			>
				<Pin size={12} fill={isPinned ? 'currentColor' : 'none'} />
			</button>
			<button
				type="button"
				class="btn-icon !size-6 {isFavorite ? 'text-yellow' : 'text-comment/70 hover:text-yellow'}"
				aria-label={isFavorite
					? `Remove ${channel.name} from favorites`
					: `Add ${channel.name} to favorites`}
				aria-pressed={isFavorite}
				title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
				onclick={() => preferences.toggleFavorite(channel.id)}
			>
				<Star size={12} fill={isFavorite ? 'currentColor' : 'none'} />
			</button>
			<button
				type="button"
				class="btn-icon !size-6 {isHidden ? 'text-orange' : 'text-comment/70 hover:text-orange'}"
				aria-label={isHidden ? `Unhide ${channel.name}` : `Hide ${channel.name}`}
				aria-pressed={isHidden}
				title={isHidden ? 'Show on the dial' : 'Hide from the dial'}
				onclick={() => preferences.toggleHidden(channel.id)}
			>
				{#if isHidden}
					<Eye size={12} />
				{:else}
					<EyeOff size={12} />
				{/if}
			</button>
		</div>
	</div>
{/snippet}

{#if mobileOpen}
	<button
		type="button"
		class="fixed inset-0 top-16 z-30 bg-ink/70 backdrop-blur-sm lg:hidden"
		aria-label="Close channel list"
		onclick={onclosemobile}
	></button>
{/if}

<aside
	inert={!desktop && !mobileOpen}
	aria-hidden={!desktop && !mobileOpen ? 'true' : undefined}
	class="fixed top-16 bottom-0 left-0 z-40 flex w-[min(21rem,90vw)] flex-col border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-16 lg:bottom-auto lg:z-10 lg:h-[calc(100dvh-4rem)] lg:w-[300px] lg:translate-x-0 {mobileOpen
		? 'translate-x-0 shadow-2xl'
		: '-translate-x-full'}"
>
	<div class="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
		<div class="min-w-0 flex-1">
			<p class="eyebrow">Channels</p>
			<p class="truncate font-display text-sm font-semibold text-fg">
				{channels.length} on the dial
			</p>
		</div>
		<span class="chip border-yellow/30 text-yellow" title="{favoriteCount} favorite channels">
			<Star size={10} fill={favoriteCount > 0 ? 'currentColor' : 'none'} />
			{favoriteCount}
		</span>
		{#if hiddenCount > 0}
			<span class="chip border-orange/30 text-orange" title="{hiddenCount} hidden channels">
				<EyeOff size={10} />
				{hiddenCount}
			</span>
		{/if}
		<button
			type="button"
			class="btn-icon lg:hidden"
			aria-label="Close channel list"
			onclick={onclosemobile}
		>
			<X size={17} />
		</button>
	</div>

	<div class="shrink-0 space-y-2 border-b border-line p-3">
		<div class="relative">
			<Search size={14} class="pointer-events-none absolute top-2.5 left-2.5 text-comment" />
			<input
				bind:this={searchInput}
				bind:value={search}
				type="search"
				class="input !py-1.5 pl-8 text-xs"
				placeholder="Find a channel…"
				aria-label="Search channels"
			/>
		</div>
		<div class="flex items-center gap-1.5">
			<SlidersHorizontal size={12} class="text-comment" />
			<select
				class="select !py-1 text-[11px]"
				bind:value={category}
				aria-label="Filter by category"
			>
				{#each categories as item (item)}
					{#if item === 'Favorites'}
						<option value={item}>Favorites ({favoriteCount})</option>
					{:else if item === 'Hidden'}
						<option value={item}>Hidden ({hiddenCount})</option>
					{:else}
						<option value={item}>{item}</option>
					{/if}
				{/each}
			</select>
		</div>
	</div>

	<nav class="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Channel lineup">
		{#if filtered.length === 0}
			<p class="px-4 py-8 text-center text-xs text-comment">{emptyMessage()}</p>
		{:else}
			{#if category === 'Hidden'}
				<p class="eyebrow px-2 pt-2 pb-1 text-orange">Hidden channels</p>
			{/if}
			{#if pinned.length > 0}
				<p class="eyebrow px-2 pt-2 pb-1 text-cyan">Pinned</p>
				{#each pinned as channel (channel.id)}
					{@render channelRow(channel)}
				{/each}
				{#if unpinned.length > 0}
					<p class="eyebrow px-2 pt-3 pb-1">All channels</p>
				{/if}
			{/if}
			{#each unpinned as channel (channel.id)}
				{@render channelRow(channel)}
			{/each}
		{/if}
	</nav>

	<div class="shrink-0 border-t border-line p-2">
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="btn-icon !size-8"
				aria-label="Previous channel"
				onclick={onprevious}
			>
				<ChevronUp size={15} />
			</button>
			<button type="button" class="btn-icon !size-8" aria-label="Next channel" onclick={onnext}>
				<ChevronDown size={15} />
			</button>
			<span class="ml-auto font-mono text-[9px] tracking-wide text-comment uppercase">
				Admin dial
			</span>
		</div>
	</div>
</aside>
