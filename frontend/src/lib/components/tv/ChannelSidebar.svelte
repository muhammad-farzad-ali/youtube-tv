<script lang="ts">
	import { onMount } from 'svelte';
	import { Search, ChevronUp, ChevronDown, SlidersHorizontal, X } from '@lucide/svelte';
	import ChannelLogo from '#lib/components/ChannelLogo.svelte';
	import type { CatalogChannel } from '#lib/schemas/catalog.schema';
	import type { PlaybackStatus } from '#lib/stores/playback.svelte';

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

	const categories = $derived(['All', ...new Set(channels.map((channel) => channel.category))]);
	const numbers = $derived(new Map(channels.map((channel, index) => [channel.id, index + 1])));
	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return channels.filter((channel) => {
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
		class="fixed inset-0 top-16 z-30 bg-ink/70 backdrop-blur-sm lg:hidden"
		aria-label="Close channel list"
		onclick={onclosemobile}
	></button>
{/if}

<aside
	inert={!desktop && !mobileOpen}
	aria-hidden={!desktop && !mobileOpen ? 'true' : undefined}
	class="fixed top-16 bottom-0 left-0 z-40 flex w-[min(20rem,88vw)] flex-col border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-16 lg:bottom-auto lg:z-10 lg:h-[calc(100dvh-4rem)] lg:w-[282px] lg:translate-x-0 {mobileOpen
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
					<option value={item}>{item}</option>
				{/each}
			</select>
		</div>
	</div>

	<nav class="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Channel lineup">
		{#if filtered.length === 0}
			<p class="px-4 py-8 text-center text-xs text-comment">No channels match.</p>
		{:else}
			{#each filtered as channel (channel.id)}
				{@const active = selectedChannelId === channel.id}
				<button
					type="button"
					class="relative mb-0.5 flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-left transition-colors {active
						? 'tuned-glow border-line bg-raised text-fg'
						: 'text-dim hover:border-line/60 hover:bg-raised/60 hover:text-fg'}"
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
