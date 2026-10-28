<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Play,
		Pause,
		SkipForward,
		Volume2,
		VolumeX,
		Maximize,
		Minimize,
		ExternalLink,
		RefreshCw,
		RotateCcw,
		Radio,
		TriangleAlert,
		LoaderCircle,
		ChartNoAxesColumnIncreasing
	} from '@lucide/svelte';
	import { playback } from '#lib/stores/playback.svelte';
	import { preferences } from '#lib/stores/preferences.svelte';
	import type { CatalogChannel } from '#lib/schemas/catalog.schema';
	import { formatDate, formatTime, youtubeThumbnail } from '#lib/utils/format';

	interface Props {
		channel: CatalogChannel;
		channelNumber: number;
		onshowguide: () => void;
	}

	let { channel, channelNumber, onshowguide }: Props = $props();
	let shell: HTMLElement | null = $state(null);
	let playerError = $state<string | null>(null);
	let fullscreen = $state(false);

	const PLAYER_ID = 'cable-tv-youtube-player';
	const active = $derived(playback.channelId === channel.id);
	const status = $derived(active ? playback.status : 'loading');
	const current = $derived(active ? playback.current : null);
	const showPlayOverlay = $derived(
		active &&
			(status === 'cued' ||
				(playback.autoplayBlocked && status !== 'playing' && status !== 'paused') ||
				status === 'idle')
	);
	const poster = $derived(current ? youtubeThumbnail(current.videoId, 'hq') : undefined);

	onMount(() => {
		playback.attach(PLAYER_ID).catch((cause) => {
			playerError = cause instanceof Error ? cause.message : 'The YouTube player could not start.';
		});
		const onFullscreen = () => (fullscreen = document.fullscreenElement === shell);
		const requestFullscreen = () => void toggleFullscreen();
		document.addEventListener('fullscreenchange', onFullscreen);
		window.addEventListener('cable-tv:fullscreen', requestFullscreen);
		return () => {
			document.removeEventListener('fullscreenchange', onFullscreen);
			window.removeEventListener('cable-tv:fullscreen', requestFullscreen);
			void playback.detach();
		};
	});

	async function toggleFullscreen() {
		if (!shell) return;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await shell.requestFullscreen();
		} catch {
			// Some mobile browsers only expose native video fullscreen.
		}
	}

	function seek(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const seconds = Number(input.value);
		if (playback.duration > 0) playback.seekToFraction(seconds / playback.duration);
	}
</script>

<section
	data-testid="tv-player"
	class="player-shell overflow-hidden rounded-lg border border-line bg-ink shadow-2xl"
	bind:this={shell}
>
	<div
		data-testid="player-topbar"
		class="player-topbar flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-3 py-2 sm:px-4"
	>
		<div class="flex min-w-0 items-center gap-2">
			<span
				class="shrink-0 rounded border border-yellow/30 bg-yellow/10 px-1.5 py-0.5 font-mono text-[10px] text-yellow tabular"
			>
				CH {String(channelNumber).padStart(2, '0')}
			</span>
			<span class="truncate font-display text-xs font-semibold tracking-wide text-fg sm:text-sm">
				{channel.name}
			</span>
			{#if current}
				<span
					data-testid="player-video-title"
					class="hidden min-w-0 truncate text-[11px] text-comment sm:inline">— {current.title}</span
				>
			{/if}
		</div>
		{#if status === 'playing'}
			<span
				class="flex shrink-0 items-center gap-1.5 rounded-full border border-red/40 bg-ink/70 px-2 py-1 font-mono text-[9px] tracking-[0.16em] text-red uppercase"
			>
				<span class="size-1.5 animate-pulse-dot rounded-full bg-red"></span>
				Tuned
			</span>
		{/if}
	</div>

	<div class="crt-overlay player-frame relative aspect-video w-full overflow-hidden bg-black">
		<div
			id={PLAYER_ID}
			class="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
		></div>

		{#if poster && (status === 'loading' || status === 'cued' || status === 'error' || status === 'idle')}
			<img src={poster} alt="" class="absolute inset-0 size-full object-cover opacity-30" />
			<div class="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent"></div>
		{/if}

		{#if playerError || status === 'error'}
			<div class="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
				<TriangleAlert size={30} class="text-red" />
				<p class="mt-3 font-display text-lg font-semibold text-fg">Playback interrupted</p>
				<p class="mt-1 max-w-md text-sm text-dim">
					{playback.error ?? playerError ?? 'This video could not be played.'}
				</p>
				<div class="mt-4 flex flex-wrap justify-center gap-2">
					{#if playerError}
						<button type="button" class="btn-primary" onclick={() => location.reload()}>
							<RefreshCw size={15} />
							Reload player
						</button>
					{:else}
						<button type="button" class="btn-primary" onclick={() => playback.retry()}>
							<RefreshCw size={15} />
							Retry
						</button>
						<button type="button" class="btn-secondary" onclick={() => playback.next()}>
							<SkipForward size={15} />
							Next video
						</button>
					{/if}
					{#if current}
						<a
							class="btn-ghost"
							href={`https://www.youtube.com/watch?v=${current.videoId}`}
							target="_blank"
							rel="noopener noreferrer"
						>
							Watch on YouTube
						</a>
					{/if}
				</div>
			</div>
		{:else if status === 'empty'}
			<div class="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
				<Radio size={34} class="text-comment" />
				<p class="mt-3 font-display text-lg font-semibold text-fg">No signal on this channel</p>
				<p class="mt-1 max-w-sm text-sm text-dim">
					No videos are available for {channel.name}. Ask the site operator to update the channel
					catalog.
				</p>
			</div>
		{:else if status === 'ended'}
			<div class="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
				<Radio size={30} class="text-green" />
				<p class="mt-3 font-display text-lg font-semibold text-fg">Queue complete</p>
				<p class="mt-1 text-sm text-dim">You have reached the end of {channel.name}.</p>
				<div class="mt-4 flex flex-wrap justify-center gap-2">
					<button type="button" class="btn-primary" onclick={() => playback.restartChannel()}>
						<RotateCcw size={15} />
						Restart channel
					</button>
					<button type="button" class="btn-secondary" onclick={onshowguide}>Open guide</button>
				</div>
			</div>
		{:else if showPlayOverlay}
			<div class="absolute inset-0 flex flex-col items-center justify-center bg-ink/40">
				<button
					type="button"
					class="flex size-20 items-center justify-center rounded-full border border-cyan/60 bg-ink/80 text-cyan shadow-glow-strong transition-transform hover:scale-105"
					aria-label="Start playback"
					onclick={() => playback.play()}
				>
					<Play size={34} class="ml-1" fill="currentColor" />
				</button>
				<p class="mt-4 font-mono text-[10px] tracking-[0.22em] text-fg uppercase">
					{playback.autoplayBlocked ? 'Autoplay blocked — tap to start' : 'Tap to start'}
				</p>
			</div>
		{:else if status === 'loading' && !playback.playerReady}
			<div class="absolute inset-0 flex flex-col items-center justify-center">
				<LoaderCircle size={28} class="animate-spin text-blue" />
				<p class="mt-3 font-mono text-[10px] tracking-[0.22em] text-comment uppercase">
					Tuning channel
				</p>
			</div>
		{/if}

		{#if fullscreen}
			<button
				type="button"
				class="btn-icon absolute top-3 right-3 z-30 !size-9 border border-line/80 bg-ink/80 text-fg shadow-lg backdrop-blur"
				aria-label="Exit fullscreen"
				onclick={toggleFullscreen}
			>
				<Minimize size={17} />
			</button>
		{/if}
	</div>

	<div
		data-testid="player-controls"
		class="player-controls border-t border-line bg-surface/80 px-3 py-2.5 sm:px-4"
	>
		<div class="flex items-center gap-2.5">
			<button
				type="button"
				class="btn-icon !size-9 text-fg"
				aria-label={status === 'playing' ? 'Pause' : 'Play'}
				onclick={() => playback.togglePause()}
			>
				{#if status === 'playing'}<Pause size={18} fill="currentColor" />{:else}<Play
						size={18}
						fill="currentColor"
					/>{/if}
			</button>
			<button
				type="button"
				class="btn-icon !size-9"
				aria-label="Next video"
				onclick={() => playback.next()}
			>
				<SkipForward size={17} />
			</button>
			<button
				type="button"
				class="btn-icon !size-9"
				aria-label={playback.muted ? 'Unmute' : 'Mute'}
				onclick={() => playback.toggleMute()}
			>
				{#if playback.muted}<VolumeX size={17} />{:else}<Volume2 size={17} />{/if}
			</button>
			<input
				class="hidden w-20 accent-blue sm:block"
				type="range"
				min="0"
				max="100"
				value={playback.volume}
				aria-label="Volume"
				oninput={(event) => playback.setVolume(Number(event.currentTarget.value))}
			/>
			<span class="font-mono text-[10px] text-comment tabular">
				{formatTime(playback.currentTime)} / {formatTime(playback.duration)}
			</span>
			<div class="ml-auto flex items-center gap-1.5">
				<button
					type="button"
					class="btn-ghost hidden !px-2.5 !py-1.5 text-[11px] xl:inline-flex"
					onclick={onshowguide}
				>
					Guide
				</button>
				{#if current}
					<a
						class="btn-icon !size-9"
						href={`https://www.youtube.com/watch?v=${current.videoId}`}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="Watch on YouTube"
					>
						<ExternalLink size={16} />
					</a>
				{/if}
				<button
					type="button"
					class="btn-icon !size-9 {preferences.progressVisible
						? 'text-cyan'
						: 'text-comment hover:text-fg'}"
					aria-label={preferences.progressVisible ? 'Hide progress bar' : 'Show progress bar'}
					aria-pressed={preferences.progressVisible}
					title={preferences.progressVisible ? 'Hide progress bar' : 'Show progress bar'}
					onclick={() => preferences.toggleProgressVisible()}
				>
					<ChartNoAxesColumnIncreasing size={16} />
				</button>
				<button
					type="button"
					class="btn-icon !size-9"
					aria-label="Toggle fullscreen"
					onclick={toggleFullscreen}
				>
					{#if fullscreen}<Minimize size={17} />{:else}<Maximize size={17} />{/if}
				</button>
			</div>
		</div>

		{#if preferences.progressVisible}
			<div data-testid="video-progress" class="mt-2 flex items-center gap-2">
				<input
					class="h-1.5 flex-1 cursor-pointer rounded-full accent-blue"
					type="range"
					min="0"
					max={Math.max(playback.duration, 1)}
					step="0.1"
					value={Math.min(playback.currentTime, playback.duration || 1)}
					aria-label="Seek"
					onchange={seek}
				/>
			</div>
		{/if}

		<div class="mt-1 flex items-center justify-between gap-3 font-mono text-[10px] text-comment">
			<span class="truncate">
				{#if current}
					Published {formatDate(current.publishedAt)}
				{:else}
					Waiting for metadata
				{/if}
			</span>
			<span class="hidden truncate sm:block">
				{playback.queuePosition > 0 ? `${playback.queuePosition} of ${playback.queue.length}` : ''}
			</span>
		</div>
	</div>
</section>
