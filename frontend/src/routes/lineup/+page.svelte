<script lang="ts">
	import { Search, Star, RotateCcw, Check, Layers3, Tv, Sparkles } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import ChannelLogo from '#lib/components/ChannelLogo.svelte';
	import ChannelCard from '#lib/components/lineup/ChannelCard.svelte';
	import LineupPanel from '#lib/components/lineup/LineupPanel.svelte';
	import PackCard from '#lib/components/lineup/PackCard.svelte';
	import { catalog } from '#lib/stores/catalog.svelte';
	import { profile } from '#lib/stores/profile.svelte';
	import { toasts } from '#lib/stores/toast.svelte';
	import { seedCatalogVideos } from '#lib/storage/database';
	import { formatDate } from '#lib/utils/format';
	import type { CatalogChannel, CatalogPack } from '#lib/schemas/catalog.schema';

	let search = $state('');
	let category = $state('All');
	let onlySelected = $state(false);
	let packOpen = $state<CatalogPack | null>(null);
	let packMode = $state<'merge' | 'replace'>('merge');
	let starterOpen = $state(false);
	let applying = $state(false);

	const categories = $derived(['All', ...catalog.categories]);
	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return catalog.channels.filter((channel) => {
			if (onlySelected && !profile.isSelected(channel.id)) return false;
			if (category !== 'All' && channel.category !== category) return false;
			if (!query) return true;
			return (
				channel.name.toLowerCase().includes(query) ||
				channel.category.toLowerCase().includes(query) ||
				channel.description.toLowerCase().includes(query)
			);
		});
	});

	const packChannels = $derived(
		packOpen
			? (packOpen.channelIds
					.map((id) => catalog.channelsById.get(id))
					.filter((channel): channel is CatalogChannel => channel !== undefined))
			: []
	);
	const selectedCount = $derived(profile.lineup.length);

	function selectedInPack(pack: CatalogPack): number {
		return pack.channelIds.filter((id) => profile.isSelected(id)).length;
	}

	function packById(id: string): CatalogChannel[] {
		return catalog.channels.filter((channel) => {
			const pack = catalog.packs.find((item) => item.id === id);
			return pack?.channelIds.includes(channel.id);
		});
	}

	async function toggleChannel(channel: CatalogChannel) {
		const selected = profile.toggleChannel(channel.id);
		if (selected && catalog.data) {
			await seedCatalogVideos(catalog.data, [channel.id]);
			toasts.success(`${channel.name} added to your lineup.`);
		} else {
			toasts.info(`${channel.name} removed from your lineup.`);
		}
	}

	function openPack(pack: CatalogPack) {
		packMode = 'merge';
		packOpen = pack;
	}

	async function applyPack() {
		if (!packOpen || !catalog.data) return;
		applying = true;
		try {
			profile.applyPack(packOpen, packMode);
			await seedCatalogVideos(catalog.data, packOpen.channelIds);
			toasts.success(
				`${packMode === 'replace' ? 'Replaced lineup with' : 'Merged'} ${packOpen.name}.`
			);
			packOpen = null;
		} finally {
			applying = false;
		}
	}

	async function restoreStarter() {
		if (!catalog.data) return;
		profile.restoreStarter();
		await seedCatalogVideos(catalog.data, profile.lineup.map((entry) => entry.channelId));
		starterOpen = false;
		toasts.success('Starter lineup restored.');
	}
</script>

<svelte:head>
	<title>Lineup · Cable TV</title>
</svelte:head>

<div class="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6">
	<PageHeader
		eyebrow="Managed channel catalog"
		title="Build your lineup"
		description="Channels are curated by the site owner. Pick the ones you want on your dial, favorite them, and arrange the order."
	>
		{#snippet actions()}
			<a href={resolve('/')} class="btn-secondary">
				<Tv size={15} />
				TV Mode
			</a>
			<button type="button" class="btn-secondary" onclick={() => (starterOpen = true)}>
				<RotateCcw size={15} />
				Restore starter
			</button>
		{/snippet}
	</PageHeader>

	<section class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Catalog summary">
		<div class="panel p-3.5">
			<p class="eyebrow">Available</p>
			<p class="stat-value mt-1">{catalog.channels.length}</p>
			<p class="mt-0.5 text-xs text-comment">managed channels</p>
		</div>
		<div class="panel p-3.5">
			<p class="eyebrow">Selected</p>
			<p class="stat-value mt-1 text-blue">{selectedCount}</p>
			<p class="mt-0.5 text-xs text-comment">in your lineup</p>
		</div>
		<div class="panel p-3.5">
			<p class="eyebrow">Categories</p>
			<p class="stat-value mt-1 text-magenta">{catalog.categories.length}</p>
			<p class="mt-0.5 text-xs text-comment">programming blocks</p>
		</div>
		<div class="panel p-3.5">
			<p class="eyebrow">Snapshot</p>
			<p class="mt-1 font-display text-sm font-semibold text-green">
				{formatDate(catalog.data?.updatedAt)}
			</p>
			<p class="mt-1 text-xs text-comment">managed by the site owner</p>
		</div>
	</section>

	<section class="mt-7">
		<div class="flex items-end justify-between gap-3">
			<div>
				<p class="eyebrow">Curated packs</p>
				<h2 class="section-title mt-1">Quick add</h2>
			</div>
			<span class="hidden font-mono text-[10px] tracking-wide text-comment uppercase sm:block">
				Merge or replace
			</span>
		</div>
		<div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{#each catalog.packs as pack (pack.id)}
				<PackCard
					{pack}
					channels={packById(pack.id)}
					selectedCount={selectedInPack(pack)}
					onopen={() => openPack(pack)}
				/>
			{/each}
		</div>
	</section>

	<div class="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
		<section aria-labelledby="catalog-heading">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p class="eyebrow">Channel catalog</p>
					<h2 id="catalog-heading" class="section-title mt-1">Choose your stations</h2>
				</div>
				<div class="relative w-full sm:w-72">
					<Search size={15} class="pointer-events-none absolute top-2.5 left-3 text-comment" />
					<input
						class="input pl-9"
						type="search"
						placeholder="Search channels…"
						bind:value={search}
						aria-label="Search channels"
					/>
				</div>
			</div>

			<div class="mt-3 flex flex-wrap items-center gap-2">
				{#each categories as item (item)}
					<button
						type="button"
						class="rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-wide transition-colors {category ===
						item
							? 'border-blue/60 bg-blue/15 text-cyan'
							: 'border-line bg-surface text-dim hover:border-line hover:bg-raised hover:text-fg'}"
						onclick={() => (category = item)}
					>
						{item}
					</button>
				{/each}
				<button
					type="button"
					class="ml-auto flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-wide transition-colors {onlySelected
						? 'border-yellow/50 bg-yellow/10 text-yellow'
						: 'border-line bg-surface text-dim hover:bg-raised'}"
					aria-pressed={onlySelected}
					onclick={() => (onlySelected = !onlySelected)}
				>
					<Star size={12} fill={onlySelected ? 'currentColor' : 'none'} />
					Selected only
				</button>
			</div>

			<div class="mt-3 flex items-center justify-between font-mono text-[10px] tracking-wide text-comment uppercase">
				<span>{filtered.length} channels shown</span>
				<span>{selectedCount} selected</span>
			</div>

			{#if filtered.length === 0}
				<div class="panel mt-3 px-5 py-12 text-center">
					<Layers3 size={24} class="mx-auto text-comment" />
					<p class="mt-3 text-sm text-dim">No channels match these filters.</p>
					<button
						type="button"
						class="btn-ghost mt-3 text-xs"
						onclick={() => {
							search = '';
							category = 'All';
							onlySelected = false;
						}}
					>
						Clear filters
					</button>
				</div>
			{:else}
				<div class="mt-3 grid gap-3 sm:grid-cols-2">
					{#each filtered as channel (channel.id)}
						<ChannelCard
							{channel}
							selected={profile.isSelected(channel.id)}
							favorite={profile.isFavorite(channel.id)}
							videoCount={channel.videos.length}
							ontoggle={() => toggleChannel(channel)}
							onfavorite={() => profile.toggleFavorite(channel.id)}
						/>
					{/each}
				</div>
			{/if}
		</section>

		<LineupPanel />
	</div>
</div>

<Modal
	open={packOpen !== null}
	title={packOpen?.name ?? 'Pack'}
	description={packOpen?.description}
	wide
	onclose={() => (packOpen = null)}
>
	{#if packOpen}
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					class="rounded-lg border p-3 text-left transition-colors {packMode === 'merge'
						? 'border-blue/60 bg-blue/10'
						: 'border-line bg-surface hover:bg-raised'}"
					onclick={() => (packMode = 'merge')}
				>
					<span class="flex items-center gap-2 font-display text-sm font-semibold text-fg">
						{#if packMode === 'merge'}<Check size={14} class="text-cyan" />{/if}
						Merge
					</span>
					<span class="mt-1 block text-xs text-dim">Add these channels after your current lineup.</span>
				</button>
				<button
					type="button"
					class="rounded-lg border p-3 text-left transition-colors {packMode === 'replace'
						? 'border-red/60 bg-red/10'
						: 'border-line bg-surface hover:bg-raised'}"
					onclick={() => (packMode = 'replace')}
				>
					<span class="flex items-center gap-2 font-display text-sm font-semibold text-fg">
						{#if packMode === 'replace'}<Check size={14} class="text-red" />{/if}
						Replace
					</span>
					<span class="mt-1 block text-xs text-dim">Replace your entire lineup with this pack.</span>
				</button>
			</div>

			{#if packMode === 'replace'}
				<p class="rounded-md border border-orange/30 bg-orange/10 px-3 py-2 text-xs text-orange">
					Your current channel order will be replaced. You can export a profile backup from the Backup
					page.
				</p>
			{/if}

			<div class="space-y-1.5">
				{#each packChannels as channel (channel.id)}
					{#if channel}
						<div class="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
							<ChannelLogo {channel} size="md" />
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-fg">{channel.name}</p>
								<p class="font-mono text-[10px] tracking-wide text-comment uppercase">
									{channel.category} · {channel.videos.length} videos
								</p>
							</div>
							{#if profile.isSelected(channel.id)}
								<span class="chip border-green/30 text-green">In lineup</span>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn-ghost" onclick={() => (packOpen = null)}>Cancel</button>
		<button type="button" class="btn-primary" disabled={applying} onclick={applyPack}>
			<Sparkles size={15} />
			{applying ? 'Applying…' : packMode === 'replace' ? 'Replace lineup' : 'Merge pack'}
		</button>
	{/snippet}
</Modal>

<Modal
	open={starterOpen}
	title="Restore starter lineup?"
	description="This replaces your current lineup with the site operator's twelve-channel starter mix. Your favorites will be reset for channels that are not in the starter."
	onclose={() => (starterOpen = false)}
>
	<p class="text-sm leading-relaxed text-dim">
		You can back up your current lineup on the Backup page before continuing. Cached video metadata is
		not deleted.
	</p>
	{#snippet footer()}
		<button type="button" class="btn-ghost" onclick={() => (starterOpen = false)}>Cancel</button>
		<button type="button" class="btn-primary" onclick={restoreStarter}>Restore starter</button>
	{/snippet}
</Modal>
