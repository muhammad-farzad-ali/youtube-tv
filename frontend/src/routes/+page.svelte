<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Menu, ListVideo, Radio, ChevronUp, ChevronDown, Signal, Info } from '@lucide/svelte';
	import ChannelSidebar from '#lib/components/tv/ChannelSidebar.svelte';
	import VideoPlayer from '#lib/components/tv/VideoPlayer.svelte';
	import ProgramGuide from '#lib/components/tv/ProgramGuide.svelte';
	import { catalog } from '#lib/stores/catalog.svelte';
	import { playback } from '#lib/stores/playback.svelte';
	import { formatRelative } from '#lib/utils/format';

	let mobileOpen = $state(false);
	let activeChannelId = $state<string | null>(catalog.channels[0]?.id ?? null);
	let numberBuffer = $state('');
	let numberTimer: ReturnType<typeof setTimeout> | null = null;
	let numberInvalid = $state(false);
	let guideEl: HTMLElement | null = $state(null);

	const channels = $derived(catalog.channels);
	const activeChannel = $derived.by(() =>
		activeChannelId
			? (catalog.channelsById.get(activeChannelId) ?? channels[0] ?? null)
			: (channels[0] ?? null)
	);
	const activeNumber = $derived(
		activeChannel ? channels.findIndex((channel) => channel.id === activeChannel.id) + 1 : 0
	);

	onMount(() => {
		const query = new URL(window.location.href).searchParams.get('ch');
		if (query && catalog.channelsById.has(query)) activeChannelId = query;
		return () => {
			if (numberTimer) clearTimeout(numberTimer);
		};
	});

	$effect(() => {
		const channel = activeChannel;
		if (!channel || playback.channelId === channel.id) return;
		void playback.tune(channel);
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const handler = (event: KeyboardEvent) => handleKeydown(event);
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});

	function selectChannel(channelId: string) {
		if (channelId === activeChannelId) {
			mobileOpen = false;
			return;
		}
		activeChannelId = channelId;
		const url = new URL(window.location.href);
		url.searchParams.set('ch', channelId);
		void goto(url, { state: {}, shallow: true, replace: true });
	}

	function stepChannel(delta: number) {
		if (channels.length === 0) return;
		const currentIndex = Math.max(
			0,
			channels.findIndex((channel) => channel.id === activeChannelId)
		);
		const next = (currentIndex + delta + channels.length) % channels.length;
		const channel = channels[next];
		if (channel) selectChannel(channel.id);
	}

	function channelByNumber(value: string) {
		const index = Number.parseInt(value, 10) - 1;
		return channels[index]?.id;
	}

	function flushNumberBuffer() {
		if (!numberBuffer) return;
		const channelId = channelByNumber(numberBuffer);
		numberInvalid = !channelId;
		if (channelId) selectChannel(channelId);
		setTimeout(() => {
			numberBuffer = '';
			numberInvalid = false;
		}, 900);
	}

	function resetNumberTimer() {
		if (numberTimer) clearTimeout(numberTimer);
		numberTimer = setTimeout(flushNumberBuffer, 1500);
	}

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		if (target && (target.matches('input, textarea, select') || target.isContentEditable)) {
			return;
		}
		if (
			target &&
			target.matches('button, a, [role="button"]') &&
			(event.key === ' ' || event.key === 'Enter')
		) {
			return;
		}
		if (event.metaKey || event.ctrlKey || event.altKey) return;

		if (/^[0-9]$/.test(event.key)) {
			event.preventDefault();
			numberBuffer = `${numberBuffer}${event.key}`.slice(-4);
			numberInvalid = false;
			resetNumberTimer();
			return;
		}
		if (event.key === 'Enter' && numberBuffer) {
			event.preventDefault();
			if (numberTimer) clearTimeout(numberTimer);
			flushNumberBuffer();
			return;
		}
		if (event.key === 'Escape') {
			mobileOpen = false;
			numberBuffer = '';
			return;
		}
		if (event.key === '/') {
			event.preventDefault();
			document.querySelector<HTMLInputElement>('input[aria-label="Search channels"]')?.focus();
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			event.preventDefault();
			stepChannel(1);
			return;
		}
		if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			event.preventDefault();
			stepChannel(-1);
			return;
		}
		if (event.key === ' ') {
			event.preventDefault();
			playback.togglePause();
			return;
		}
		if (event.key === 'n' || event.key === 'N') {
			event.preventDefault();
			playback.next();
			return;
		}
		if (event.key === 'm' || event.key === 'M') {
			event.preventDefault();
			playback.toggleMute();
			return;
		}
		if (event.key === 'f' || event.key === 'F') {
			event.preventDefault();
			window.dispatchEvent(new CustomEvent('cable-tv:fullscreen'));
		}
	}

	function showGuide() {
		guideEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{activeChannel ? `${activeChannel.name} · Cable TV` : 'Cable TV'}</title>
</svelte:head>

{#if activeChannel}
	<div class="flex">
		<ChannelSidebar
			{channels}
			selectedChannelId={activeChannel.id}
			playingChannelId={playback.channelId}
			playingStatus={playback.status}
			{mobileOpen}
			onselect={selectChannel}
			onprevious={() => stepChannel(-1)}
			onnext={() => stepChannel(1)}
			onclosemobile={() => (mobileOpen = false)}
		/>

		<div class="min-w-0 flex-1 p-3 sm:p-4">
			<div class="mb-3 flex items-center gap-2 xl:hidden">
				<button
					type="button"
					class="btn-secondary !px-2.5 !py-1.5 text-xs"
					onclick={() => (mobileOpen = true)}
				>
					<Menu size={15} />
					Channels
				</button>
				<div class="min-w-0 flex-1">
					<p class="truncate font-display text-sm font-semibold text-fg">{activeChannel.name}</p>
				</div>
				<button type="button" class="btn-ghost !px-2 !py-1.5 text-xs" onclick={showGuide}>
					<ListVideo size={15} />
					Guide
				</button>
			</div>

			<div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div class="min-w-0">
					<VideoPlayer
						channel={activeChannel}
						channelNumber={activeNumber}
						onshowguide={showGuide}
					/>

					<div class="mt-3 grid gap-3 sm:grid-cols-3">
						<div class="panel flex items-center gap-3 p-3">
							<Signal size={16} class="text-green" />
							<div>
								<p class="eyebrow">Source</p>
								<p class="text-xs text-dim">
									Catalog · synced {formatRelative(activeChannel.snapshotAt)}
								</p>
							</div>
						</div>
						<div class="panel flex items-center gap-3 p-3">
							<Radio size={16} class="text-red" />
							<div>
								<p class="eyebrow">Queue</p>
								<p class="text-xs text-dim">{playback.queue.length} videos · newest first</p>
							</div>
						</div>
						<div class="panel flex items-center gap-3 p-3">
							<Info size={16} class="text-cyan" />
							<div>
								<p class="eyebrow">Keyboard</p>
								<p class="text-xs text-dim">↑↓ channels · / search · Space pause · F fullscreen</p>
							</div>
						</div>
					</div>

					<div class="mt-3 flex items-center justify-between gap-2 xl:hidden">
						<button
							type="button"
							class="btn-secondary !px-2.5 !py-1.5 text-xs"
							onclick={() => stepChannel(-1)}
						>
							<ChevronUp size={14} />
							Previous
						</button>
						<button
							type="button"
							class="btn-secondary !px-2.5 !py-1.5 text-xs"
							onclick={() => stepChannel(1)}
						>
							Next channel
							<ChevronDown size={14} />
						</button>
					</div>
				</div>

				<div bind:this={guideEl} id="program-guide" class="min-w-0 scroll-mt-20">
					<ProgramGuide channel={activeChannel} />
				</div>
			</div>
		</div>
	</div>

	{#if numberBuffer}
		<div
			class="pointer-events-none fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-5 py-3 text-center shadow-2xl backdrop-blur {numberInvalid
				? 'border-red/50 bg-ink/90'
				: 'border-cyan/50 bg-ink/90'}"
		>
			<p class="font-mono text-[9px] tracking-[0.24em] text-comment uppercase">Channel</p>
			<p
				class="font-display text-3xl font-bold tracking-[0.2em] {numberInvalid
					? 'text-red'
					: 'text-cyan'}"
			>
				{numberBuffer}
			</p>
			{#if numberInvalid}
				<p class="mt-0.5 font-mono text-[9px] tracking-wide text-red uppercase">No such channel</p>
			{/if}
		</div>
	{/if}
{:else}
	<div class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl items-center px-4">
		<div class="panel w-full p-8 text-center">
			<Radio size={28} class="mx-auto text-comment" />
			<h1 class="mt-3 font-display text-xl font-semibold text-fg">No channels on the dial</h1>
			<p class="mt-2 text-sm text-dim">
				The site operator has not published a channel catalog yet.
			</p>
		</div>
	</div>
{/if}
