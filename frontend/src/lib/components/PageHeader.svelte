<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		eyebrow?: string;
		title: string;
		description?: string;
		actions?: Snippet;
	}

	let { eyebrow, title, description, actions }: Props = $props();
</script>

<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
	<div class="min-w-0">
		{#if eyebrow}
			<p class="eyebrow">{eyebrow}</p>
		{/if}
		<h1 class="mt-1 font-display text-2xl font-semibold tracking-wide text-fg sm:text-3xl">
			{title}
		</h1>
		{#if description}
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-dim">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 flex-wrap items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</header>
