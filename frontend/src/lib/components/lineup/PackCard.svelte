<script lang="ts">
	import { Layers3 } from '@lucide/svelte';
	import ChannelLogo from '#lib/components/ChannelLogo.svelte';
	import type { CatalogChannel, CatalogPack } from '#lib/schemas/catalog.schema';

	interface Props {
		pack: CatalogPack;
		channels: CatalogChannel[];
		selectedCount: number;
		onopen: () => void;
	}

	let { pack, channels, selectedCount, onopen }: Props = $props();

	const gradients: Record<string, string> = {
		starter: 'from-blue/25 via-cyan/10 to-transparent',
		technology: 'from-blue/25 via-cyan/10 to-transparent',
		science: 'from-cyan/25 via-green/10 to-transparent',
		news: 'from-red/25 via-orange/10 to-transparent',
		gaming: 'from-magenta/25 via-blue/10 to-transparent',
		learning: 'from-green/25 via-yellow/10 to-transparent',
		developer: 'from-blue/25 via-cyan/10 to-transparent',
		comedy: 'from-orange/25 via-red/10 to-transparent',
		adventure: 'from-green/25 via-cyan/10 to-transparent'
	};
	const gradient = $derived(gradients[pack.id] ?? 'from-blue/20 via-raised to-transparent');
</script>

<article class="panel group relative overflow-hidden">
	<div class="absolute inset-0 bg-gradient-to-br {gradient}"></div>
	<div class="relative p-4">
		<div class="flex items-start justify-between gap-3">
			<div class="flex -space-x-2">
				{#each channels.slice(0, 3) as channel (channel.id)}
					<ChannelLogo {channel} size="md" class="shadow-lg ring-2 ring-surface" />
				{/each}
			</div>
			{#if selectedCount === channels.length && channels.length > 0}
				<span class="chip border-green/30 text-green">Added</span>
			{:else if selectedCount > 0}
				<span class="chip border-blue/30 text-blue">{selectedCount}/{channels.length}</span>
			{:else}
				<span class="chip">
					<Layers3 size={11} />
					PACK
				</span>
			{/if}
		</div>

		<h3 class="mt-4 font-display text-base font-semibold tracking-wide text-fg">{pack.name}</h3>
		<p class="mt-1 line-clamp-2 min-h-9 text-xs leading-relaxed text-dim">{pack.description}</p>

		<div class="mt-4 flex items-center justify-between gap-3">
			<span class="font-mono text-[10px] tracking-wide text-comment uppercase">
				{channels.length} channels
			</span>
			<button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" onclick={onopen}>
				Preview
			</button>
		</div>
	</div>
</article>
