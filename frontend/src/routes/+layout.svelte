<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import { Radio, RefreshCw, CircleAlert } from '@lucide/svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import { app } from '#lib/stores/app.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		void app.initialize();
	});
</script>

<svelte:head>
	<title>Cable TV</title>
	<link rel="icon" href={asset('favicon.svg')} />
</svelte:head>

<AppHeader />

{#if app.status === 'ready'}
	<main class="min-h-[calc(100dvh-4rem)] pb-6">
		{@render children()}
	</main>
{:else if app.status === 'error'}
	<div class="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4">
		<div class="panel w-full max-w-lg p-6">
			<div class="flex items-center gap-3 text-red">
				<CircleAlert size={22} />
				<h1 class="font-display text-xl font-semibold tracking-wide">Signal lost</h1>
			</div>
			<p class="mt-3 text-sm leading-relaxed text-dim">
				The channel catalog could not be loaded. Check that <code class="text-cyan"
					>catalog.json</code
				>
				was deployed with the app.
			</p>
			{#if app.error}
				<pre
					class="mt-3 overflow-x-auto rounded-md border border-line bg-ink p-3 text-xs text-red">{app.error}</pre>
			{/if}
			<button type="button" class="btn-primary mt-5" onclick={() => app.retry()}>
				<RefreshCw size={15} />
				Try again
			</button>
		</div>
	</div>
{:else}
	<div class="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-5">
		<div
			class="relative flex size-16 items-center justify-center rounded-xl border border-blue/30 bg-blue/10 text-blue"
		>
			<Radio size={30} class="animate-pulse" />
			<span class="absolute inset-0 animate-ping rounded-xl border border-blue/20"></span>
		</div>
		<div class="text-center">
			<p class="font-display text-lg font-semibold tracking-[0.28em] text-fg uppercase">Tuning</p>
			<p class="mt-1 font-mono text-[10px] tracking-[0.22em] text-comment uppercase">
				Loading channel catalog
			</p>
		</div>
	</div>
{/if}
