<script lang="ts">
	import { Check, Plus, Star, Video, Clock3 } from '@lucide/svelte';
	import ChannelLogo from '#lib/components/ChannelLogo.svelte';
	import { categoryTone, formatRelative } from '#lib/utils/format';
	import type { CatalogChannel } from '#lib/schemas/catalog.schema';

	interface Props {
		channel: CatalogChannel;
		selected: boolean;
		favorite: boolean;
		videoCount: number;
		ontoggle: () => void;
		onfavorite: () => void;
	}

	let { channel, selected, favorite, videoCount, ontoggle, onfavorite }: Props = $props();
</script>

<article
	class="group relative flex flex-col rounded-lg border bg-surface p-4 transition-colors {selected
		? 'border-blue/60 shadow-glow'
		: 'border-line hover:border-line/80 hover:bg-raised/60'}"
>
	<div class="flex items-start gap-3">
		<ChannelLogo {channel} size="lg" />
		<div class="min-w-0 flex-1">
			<h3 class="truncate font-display text-sm font-semibold tracking-wide text-fg">
				{channel.name}
			</h3>
			<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
				<span
					class="rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide {categoryTone(
						channel.category
					)}">{channel.category}</span
				>
				{#if selected}
					<span class="chip border-green/30 text-green">
						<span class="size-1.5 rounded-full bg-green"></span>
						In lineup
					</span>
				{/if}
			</div>
		</div>
		{#if selected}
			<button
				type="button"
				class="btn-icon -mt-1 -mr-1 {favorite ? 'text-yellow' : 'text-comment'}"
				aria-label={favorite ? `Remove ${channel.name} from favorites` : `Favorite ${channel.name}`}
				aria-pressed={favorite}
				onclick={onfavorite}
			>
				<Star size={16} fill={favorite ? 'currentColor' : 'none'} />
			</button>
		{/if}
	</div>

	<p class="mt-3 line-clamp-2 min-h-9 text-xs leading-relaxed text-dim">{channel.description}</p>

	<div class="mt-3 flex items-center justify-between gap-3">
		<div class="flex items-center gap-3 font-mono text-[10px] text-comment">
			<span class="flex items-center gap-1"><Video size={12} />{videoCount}</span>
			<span class="flex items-center gap-1">
				<Clock3 size={12} />
				{formatRelative(channel.snapshotAt)}
			</span>
		</div>
		<button
			type="button"
			class={selected ? 'btn-secondary !px-2.5 !py-1.5' : 'btn-primary !px-2.5 !py-1.5'}
			aria-pressed={selected}
			onclick={ontoggle}
		>
			{#if selected}
				<Check size={14} />
				Selected
			{:else}
				<Plus size={14} />
				Add
			{/if}
		</button>
	</div>
</article>
