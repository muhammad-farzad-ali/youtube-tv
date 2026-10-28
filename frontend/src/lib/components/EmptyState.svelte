<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TvMinimal } from '@lucide/svelte';

	interface Props {
		title: string;
		description?: string;
		icon?: Snippet;
		actions?: Snippet;
	}

	let { title, description, icon, actions }: Props = $props();
</script>

<div class="panel flex flex-col items-center justify-center px-6 py-12 text-center">
	<div class="mb-4 flex size-14 items-center justify-center rounded-full border border-line bg-ink text-comment">
		{#if icon}
			{@render icon()}
		{:else}
			<TvMinimal size={26} />
		{/if}
	</div>
	<h2 class="font-display text-lg font-semibold tracking-wide text-fg">{title}</h2>
	{#if description}
		<p class="mt-2 max-w-md text-sm leading-relaxed text-dim">{description}</p>
	{/if}
	{#if actions}
		<div class="mt-5 flex flex-wrap justify-center gap-2">
			{@render actions()}
		</div>
	{/if}
</div>
