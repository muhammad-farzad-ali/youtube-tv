<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Search,
		Star,
		ChevronLeft,
		ChevronRight,
		ChevronUp,
		ChevronDown,
		SlidersHorizontal,
		X,
		Radio
	} from '@lucide/svelte';
	import ChannelLogo from '#lib/components/ChannelLogo.svelte';
	import { profile } from '#lib/stores/profile.svelte';
	import type { CatalogChannel } from '#lib/schemas/catalog.schema';
	import type { PlaybackStatus } from '#lib/stores/playback.svelte';

	interface Props {
		channels: CatalogChannel[];
		selectedChannelId: string | null;
		numbers: Map<string, number>;
		playingChannelId: string | null;
		playingStatus: PlaybackStatus;
		collapsed: boolean;
		mobileOpen: boolean;
		onselect: (channelId: string) => void;
		oncollapse: () => void;
		onprevious: () => void;
		onnext: () => void;
		onclosemobile: () => void;
		onopenlineup: () => void;
	}

	let {
		channels,
		selectedChannelId,
		numbers,
		playingChannelId,
		playingStatus,
		collapsed,
		mobileOpen,
		onselect,
		oncollapse,
		onprevious,
		onnext,
		onclosemobile,
		onopenlineup
	}: Props = $props();

	let search = $state('');
	let category = $state('All');
	let favoritesOnly = $state(false);
	let searchInput: HTMLInputElement | null = $state(null);
	let desktop = $state(false);

	onMount(() => {
		const media = window.matchMedia('(min-width: 1024px)');
		desktop = media.matches;
		const update = () => (desktop = media.matches);
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	const categories = $derived(['All', ...new Set(channels.map((channel) => channel.category))]);
	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return channels.filter((channel) => {
			if (favoritesOnly && !profile.isFavorite(channel.id)) return false;
			if (category !== 'All' && channel.category !== category) return false;
			if (!query) return true;
			return (
				channel.name.toLowerCase().includes(query) || channel.category.toLowerCase().includes(query)
			);
		});
	});

	export function focusSearch() {
		searchInput?.focus();
	}

	export function clearSearch() {
		search = '';
		searchInput?.blur();
	}

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
</script>

{#if mobileOpen}
	<button
		type="button"
		class="fixed inset-0 top-16 bottom-16 z-30 bg-ink/70 backdrop-blur-sm lg:hidden"
		aria-label="Close channel list"
		onclick={onclosemobile}
	></button>
{/if}

<aside
	inert={!desktop && !mobileOpen}
	aria-hidden={!desktop && !mobileOpen ? 'true' : undefined}
	class="fixed top-16 bottom-16 left-0 z-40 flex w-[min(20rem,88vw)] flex-col border-r border-line bg-surface transition-[transform,width] duration-200 lg:sticky lg:top-16 lg:bottom-auto lg:z-10 lg:h-[calc(100dvh-4rem)] lg:translate-x-0 {mobileOpen
		? 'translate-x-0 shadow-2xl'
		: '-translate-x-full'} {collapsed ? 'lg:w-[76px]' : 'lg:w-[282px]'}"
>
	<div class="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
		{#if !collapsed}
			<div class="min-w-0 flex-1">
				<p class="eyebrow">Channels</p>
				<p class="truncate font-display text-sm font-semibold text-fg">
					{channels.length} on the dial
				</p>
			</div>
		{:else}
			<span class="flex-1 text-center font-mono text-[10px] text-comment">{channels.length}</span>
		{/if}
		<button
			type="button"
			class="btn-icon hidden lg:inline-flex"
			aria-label={collapsed ? 'Expand channel sidebar' : 'Collapse channel sidebar'}
			onclick={oncollapse}
		>
			{#if collapsed}<ChevronRight size={16} />{:else}<ChevronLeft size={16} />{/if}
		</button>
		<button
			type="button"
			class="btn-icon lg:hidden"
			aria-label="Close channel list"
			onclick={onclosemobile}
		>
			<X size={17} />
		</button>
	</div>

	{#if !collapsed}
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
						<option value={item}>{item}</option>
					{/each}
				</select>
				<button
					type="button"
					class="btn-icon !size-8 {favoritesOnly ? 'text-yellow' : ''}"
					aria-label="Show favorites only"
					aria-pressed={favoritesOnly}
					onclick={() => (favoritesOnly = !favoritesOnly)}
				>
					<Star size={14} fill={favoritesOnly ? 'currentColor' : 'none'} />
				</button>
			</div>
		</div>
	{/if}

	<nav class="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Channel lineup">
		{#if channels.length === 0}
			<div class="px-4 py-10 text-center">
				<Radio size={24} class="mx-auto text-comment" />
				<p class="mt-3 text-xs leading-relaxed text-dim">Your lineup is empty.</p>
				<button type="button" class="btn-secondary mt-3 !py-1.5 text-xs" onclick={onopenlineup}>
					Choose channels
				</button>
			</div>
		{:else if filtered.length === 0}
			<p class="px-4 py-8 text-center text-xs text-comment">No channels match.</p>
		{:else}
			{#each filtered as channel (channel.id)}
				{@const active = selectedChannelId === channel.id}
				<button
					type="button"
					class="relative mb-0.5 flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-left transition-colors {active
						? 'tuned-glow border-line bg-raised text-fg'
						: 'text-dim hover:border-line/60 hover:bg-raised/60 hover:text-fg'} {collapsed
						? 'lg:justify-center lg:px-1'
						: ''}"
					aria-current={active ? 'true' : undefined}
					title={collapsed ? channel.name : undefined}
					onclick={() => choose(channel.id)}
				>
					<span
						class="w-7 shrink-0 text-right font-mono text-[10px] text-yellow tabular {collapsed
							? 'lg:hidden'
							: ''}"
					>
						{String(numbers.get(channel.id) ?? 0).padStart(2, '0')}
					</span>
					<ChannelLogo {channel} size={collapsed ? 'md' : 'sm'} />
					{#if !collapsed}
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
						{#if profile.isFavorite(channel.id)}
							<Star size={11} class="shrink-0 text-yellow" fill="currentColor" />
						{/if}
					{:else if isPlaying(channel.id)}
						<span class="absolute right-1.5 bottom-1.5 size-2 rounded-full bg-red"></span>
					{/if}
				</button>
			{/each}
		{/if}
	</nav>

	{#if !collapsed}
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
				<button
					type="button"
					class="btn-ghost ml-auto !px-2 !py-1.5 text-[11px]"
					onclick={onopenlineup}
				>
					Edit lineup
				</button>
			</div>
		</div>
	{/if}
</aside>
