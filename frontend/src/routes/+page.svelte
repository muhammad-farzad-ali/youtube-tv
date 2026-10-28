<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { Menu, ListVideo, Radio, ChevronUp, ChevronDown, Signal, Info } from '@lucide/svelte';
	import ChannelSidebar from '#lib/components/tv/ChannelSidebar.svelte';
	import VideoPlayer from '#lib/components/tv/VideoPlayer.svelte';
	import ProgramGuide from '#lib/components/tv/ProgramGuide.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { profile } from '#lib/stores/profile.svelte';
	import { app } from '#lib/stores/app.svelte';
	import { playback } from '#lib/stores/playback.svelte';
	import { toasts } from '#lib/stores/toast.svelte';
	import { getSyncRecords, type SyncRecord } from '#lib/storage/database';
	import { refreshChannels, summarizeRefresh } from '#lib/services/feedService';
	import { resolve } from '$app/paths';

	let mobileOpen = $state(false);
	let refreshing = $state(false);
	let syncRecords = $state<Record<string, SyncRecord>>({});
	let lastTunedId = $state<string | null>(null);
	let numberBuffer = $state('');
	let numberTimer: ReturnType<typeof setTimeout> | null = null;
	let numberInvalid = $state(false);
	let guideEl: HTMLElement | null = $state(null);

	const channels = $derived(profile.selectedChannels);
	const activeChannel = $derived(profile.selectedChannel);
	const activeChannelId = $derived(activeChannel?.id ?? null);
	const activeNumber = $derived(
		activeChannelId ? (profile.channelNumbers.get(activeChannelId) ?? 0) : 0
	);
	const sync = $derived(activeChannelId ? syncRecords[activeChannelId] : undefined);

	onMount(() => {
		const query = new URL(window.location.href).searchParams.get('ch');
		if (query && profile.isSelected(query)) {
			profile.selectChannel(query);
		}
		void loadSync();
	});

	$effect(() => {
		if (app.status !== 'ready') return;
		const channelId = activeChannelId;
		if (!channelId) return;
		if (lastTunedId === channelId && playback.channelId === channelId) return;
		lastTunedId = channelId;
		void app.ensureChannelVideos(channelId).then(() => playback.tune(channelId));
	});

	$effect(() => {
		const minutes = profile.settings.autoRefreshMinutes;
		const proxy = profile.settings.feedProxyUrl;
		if (minutes <= 0 || !proxy.trim()) return;
		const interval = setInterval(() => {
			if (document.visibilityState === 'visible') void refreshAll(true);
		}, minutes * 60_000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const handler = (event: KeyboardEvent) => handleKeydown(event);
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});

	async function loadSync() {
		syncRecords = await getSyncRecords();
	}

	function selectChannel(channelId: string) {
		if (channelId === activeChannelId) {
			mobileOpen = false;
			return;
		}
		lastTunedId = null;
		profile.selectChannel(channelId);
		const url = new URL(window.location.href);
		url.searchParams.set('ch', channelId);
		void replaceState(url, {});
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
		const number = Number.parseInt(value, 10);
		if (!Number.isFinite(number)) return undefined;
		for (const [channelId, channelNumber] of profile.channelNumbers.entries()) {
			if (channelNumber === number) return channelId;
		}
		return undefined;
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
		if (
			target &&
			(target.matches('input, textarea, select') || target.isContentEditable)
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
		}
	}

	async function refreshCurrent() {
		if (!activeChannelId) return;
		refreshing = true;
		try {
			const results = await refreshChannels([activeChannelId], profile.settings.feedProxyUrl);
			await loadSync();
			await playback.checkForNewVideos(activeChannelId);
			const message = summarizeRefresh(results);
			if (results[0]?.ok) toasts.success(message);
			else toasts.error(message);
		} finally {
			refreshing = false;
		}
	}

	async function refreshAll(silent = false) {
		if (channels.length === 0) return;
		refreshing = true;
		try {
			const results = await refreshChannels(
				channels.map((channel) => channel.id),
				profile.settings.feedProxyUrl
			);
			await loadSync();
			if (activeChannelId) await playback.checkForNewVideos(activeChannelId);
			if (!silent) {
				const message = summarizeRefresh(results);
				if (results.some((result) => result.ok)) toasts.success(message);
				else toasts.error(message);
			}
		} finally {
			refreshing = false;
		}
	}

	function showGuide() {
		guideEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{activeChannel ? `${activeChannel.name} · Cable TV` : 'Cable TV'}</title>
</svelte:head>

{#if channels.length === 0}
	<div class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl items-center px-4">
		<EmptyState
			title="Your lineup is empty"
			description="The site operator manages the channel catalog, but you choose what appears on your dial. Add a few channels to get started."
		>
			{#snippet actions()}
				<a href={resolve('/lineup')} class="btn-primary">
					<ListVideo size={15} />
					Choose channels
				</a>
			{/snippet}
		</EmptyState>
	</div>
{:else}
	<div class="flex">
		<ChannelSidebar
			{channels}
			selectedChannelId={activeChannelId}
			numbers={profile.channelNumbers}
			playingChannelId={playback.channelId}
			playingStatus={playback.status}
			collapsed={profile.settings.sidebarCollapsed}
			{mobileOpen}
			onselect={selectChannel}
			oncollapse={() => profile.setSetting('sidebarCollapsed', !profile.settings.sidebarCollapsed)}
			onprevious={() => stepChannel(-1)}
			onnext={() => stepChannel(1)}
			onclosemobile={() => (mobileOpen = false)}
			onopenlineup={() => void goto(resolve('/lineup'))}
		/>

		<div class="min-w-0 flex-1 p-3 sm:p-4">
			<div class="mb-3 flex items-center gap-2 xl:hidden">
				<button type="button" class="btn-secondary !px-2.5 !py-1.5 text-xs" onclick={() => (mobileOpen = true)}>
					<Menu size={15} />
					Channels
				</button>
				<div class="min-w-0 flex-1">
					<p class="truncate font-display text-sm font-semibold text-fg">
						{activeChannel?.name ?? 'No channel'}
					</p>
				</div>
				<button type="button" class="btn-ghost !px-2 !py-1.5 text-xs" onclick={showGuide}>
					<ListVideo size={15} />
					Guide
				</button>
			</div>

			<div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div class="min-w-0">
					{#if activeChannel}
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
										{sync?.status === 'ok' && sync.lastSyncedAt
											? 'Live feed cached'
											: 'Catalog snapshot'}
									</p>
								</div>
							</div>
							<div class="panel flex items-center gap-3 p-3">
								<Radio size={16} class="text-red" />
								<div>
									<p class="eyebrow">Queue</p>
									<p class="text-xs text-dim">
										{playback.queue.length} videos · newest first
									</p>
								</div>
							</div>
							<div class="panel flex items-center gap-3 p-3">
								<Info size={16} class="text-cyan" />
								<div>
									<p class="eyebrow">Keyboard</p>
									<p class="text-xs text-dim">↑↓ channels · / search · Space pause</p>
								</div>
							</div>
						</div>

						<div class="mt-3 flex items-center justify-between gap-2 xl:hidden">
							<button type="button" class="btn-secondary !px-2.5 !py-1.5 text-xs" onclick={() => stepChannel(-1)}>
								<ChevronUp size={14} />
								Previous
							</button>
							<button type="button" class="btn-secondary !px-2.5 !py-1.5 text-xs" onclick={() => stepChannel(1)}>
								Next channel
								<ChevronDown size={14} />
							</button>
						</div>
					{:else}
						<EmptyState
							title="Channel not available"
							description="This channel is no longer part of the catalog. Choose another station from your lineup."
						>
							{#snippet actions()}
								<a href={resolve('/lineup')} class="btn-primary">Edit lineup</a>
							{/snippet}
						</EmptyState>
					{/if}
				</div>

				<div bind:this={guideEl} id="program-guide" class="min-w-0 scroll-mt-20">
					{#if activeChannel}
						<ProgramGuide
							channel={activeChannel}
							{sync}
							{refreshing}
							onrefresh={refreshCurrent}
						/>
						{#if channels.length > 1}
							<button
								type="button"
								class="btn-ghost mt-2 w-full !py-1.5 text-[10px]"
								disabled={refreshing}
								onclick={() => refreshAll()}
							>
								Refresh all {channels.length} selected channels
							</button>
						{/if}
					{/if}
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
			<p class="font-display text-3xl font-bold tracking-[0.2em] {numberInvalid ? 'text-red' : 'text-cyan'}">
				{numberBuffer}
			</p>
			{#if numberInvalid}
				<p class="mt-0.5 font-mono text-[9px] tracking-wide text-red uppercase">No such channel</p>
			{/if}
		</div>
	{/if}
{/if}
