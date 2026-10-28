<script lang="ts">
	import { ArrowDown, ArrowUp, Star, X, Tv } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import ChannelLogo from '#lib/components/ChannelLogo.svelte';
	import { profile } from '#lib/stores/profile.svelte';
	import { catalog } from '#lib/stores/catalog.svelte';

	let { class: className = '' }: { class?: string } = $props();

	const entries = $derived(
		profile.lineup
			.map((entry, index) => ({
				entry,
				index,
				channel: catalog.channelsById.get(entry.channelId),
				number: profile.settings.numberStart + index
			}))
			.filter((row) => row.channel !== undefined)
	);
</script>

<aside
	class="panel flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden lg:sticky lg:top-20 {className}"
>
	<header class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
		<div>
			<p class="eyebrow">My lineup</p>
			<p class="mt-0.5 font-display text-sm font-semibold text-fg">
				{entries.length} channel{entries.length === 1 ? '' : 's'}
			</p>
		</div>
		<a href={resolve('/')} class="btn-ghost !px-2.5 !py-1.5 text-xs">
			<Tv size={14} />
			Watch
		</a>
	</header>

	{#if entries.length === 0}
		<div class="px-4 py-8 text-center">
			<p class="text-sm text-dim">No channels selected yet.</p>
			<p class="mt-1 text-xs text-comment">Add channels from the catalog to start watching.</p>
		</div>
	{:else}
		<ol class="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
			{#each entries as row (row.entry.channelId)}
				<li class="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-raised/70">
					<span class="w-8 shrink-0 font-mono text-[11px] text-yellow tabular">
						{String(row.number).padStart(2, '0')}
					</span>
					{#if row.channel}
						<ChannelLogo channel={row.channel} size="sm" />
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-medium text-fg">{row.channel.name}</p>
							<p class="truncate font-mono text-[9px] tracking-wide text-comment uppercase">
								{row.channel.category}
							</p>
						</div>
					{/if}
					<div
						class="flex items-center gap-0.5 opacity-50 transition-opacity group-hover:opacity-100"
					>
						<button
							type="button"
							class="btn-icon !size-7 {row.entry.favorite ? 'text-yellow' : ''}"
							aria-label="Toggle favorite"
							onclick={() => profile.toggleFavorite(row.entry.channelId)}
						>
							<Star size={13} fill={row.entry.favorite ? 'currentColor' : 'none'} />
						</button>
						<button
							type="button"
							class="btn-icon !size-7"
							aria-label="Move up"
							disabled={row.index === 0}
							onclick={() => profile.move(row.entry.channelId, -1)}
						>
							<ArrowUp size={13} />
						</button>
						<button
							type="button"
							class="btn-icon !size-7"
							aria-label="Move down"
							disabled={row.index === entries.length - 1}
							onclick={() => profile.move(row.entry.channelId, 1)}
						>
							<ArrowDown size={13} />
						</button>
						<button
							type="button"
							class="btn-icon !size-7 hover:text-red"
							aria-label="Remove from lineup"
							onclick={() => profile.removeChannel(row.entry.channelId)}
						>
							<X size={13} />
						</button>
					</div>
				</li>
			{/each}
		</ol>
	{/if}

	<footer class="border-t border-line px-4 py-2.5 font-mono text-[10px] tracking-wide text-comment">
		Numbers start at {String(profile.settings.numberStart).padStart(2, '0')}
	</footer>
</aside>
