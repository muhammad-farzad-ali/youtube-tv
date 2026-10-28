<script lang="ts">
	import { Play, RefreshCw, Radio, Clock3, CalendarDays, VideoOff } from '@lucide/svelte';
	import ChannelLogo from '#lib/components/ChannelLogo.svelte';
	import { playback } from '#lib/stores/playback.svelte';
	import type { CatalogChannel } from '#lib/schemas/catalog.schema';
	import type { SyncRecord } from '#lib/storage/database';
	import { formatDate, formatDuration, formatRelative, youtubeThumbnail } from '#lib/utils/format';

	interface Props {
		channel: CatalogChannel;
		sync: SyncRecord | undefined;
		refreshing: boolean;
		onrefresh: () => void;
	}

	let { channel, sync, refreshing, onrefresh }: Props = $props();

	const active = $derived(playback.channelId === channel.id);
	const queue = $derived(active ? playback.queue : []);
	const currentIndex = $derived(active ? playback.index : -1);
	const nextVideos = $derived(
		queue
			.map((video, index) => ({ video, index }))
			.filter((row) => row.index > currentIndex)
			.slice(0, 6)
	);
	const current = $derived(active ? playback.current : null);
	const progress = $derived(active ? playback.progress : 0);
	const snapshotLabel = $derived(
		sync?.status === 'ok' && sync.lastSyncedAt
			? `Live · ${formatRelative(sync.lastSyncedAt)}`
			: `Snapshot · ${formatRelative(channel.snapshotAt)}`
	);
	const live = $derived(sync?.status === 'ok');
</script>

<aside class="panel flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden">
	<header class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
		<div class="flex min-w-0 items-center gap-2.5">
			<ChannelLogo {channel} size="md" />
			<div class="min-w-0">
				<p class="eyebrow">Program guide</p>
				<h2 class="truncate font-display text-sm font-semibold text-fg">{channel.name}</h2>
			</div>
		</div>
		<span
			class="chip shrink-0 {live ? 'border-green/30 text-green' : 'border-yellow/30 text-yellow'}"
			title={snapshotLabel}
		>
			<span class="size-1.5 rounded-full {live ? 'bg-green' : 'bg-yellow'}"></span>
			{live ? 'Live' : 'Snapshot'}
		</span>
	</header>

	<div class="scroll-thin min-h-0 flex-1 overflow-y-auto">
		{#if current}
			<section class="border-b border-line p-3" aria-labelledby="now-playing">
				<div class="flex items-center justify-between gap-2">
					<p id="now-playing" class="eyebrow text-red">Now playing</p>
					<span class="font-mono text-[10px] text-comment tabular">
						{currentIndex + 1} / {queue.length}
					</span>
				</div>
				<div class="mt-2 overflow-hidden rounded-md border border-line bg-ink">
					<div class="relative aspect-video">
						<img
							src={youtubeThumbnail(current.videoId, 'hq')}
							alt=""
							class="size-full object-cover opacity-80"
							loading="lazy"
						/>
						<div class="absolute inset-0 bg-gradient-to-t from-ink to-transparent"></div>
						<div class="absolute inset-x-0 bottom-0 p-2.5">
							<p class="line-clamp-2 text-xs font-medium leading-snug text-fg">{current.title}</p>
							<div class="mt-1 flex items-center gap-2 font-mono text-[9px] text-comment">
								<span class="flex items-center gap-1">
									<CalendarDays size={10} />
									{formatDate(current.publishedAt)}
								</span>
								{#if formatDuration(current.durationSeconds)}
									<span class="flex items-center gap-1">
										<Clock3 size={10} />
										{formatDuration(current.durationSeconds)}
									</span>
								{/if}
							</div>
						</div>
					</div>
					<div class="h-1 bg-line">
						<div class="h-full bg-red transition-[width] duration-500" style="width: {progress * 100}%"></div>
					</div>
				</div>
			</section>

			<section class="border-b border-line p-3">
				<div class="flex items-center justify-between gap-2">
					<p class="eyebrow">Up next</p>
					<span class="font-mono text-[9px] tracking-wide text-comment uppercase">Newest → oldest</span>
				</div>
				{#if nextVideos.length === 0}
					<p class="mt-3 text-xs text-comment">End of the queue.</p>
				{:else}
					<ol class="mt-2 space-y-1">
						{#each nextVideos as row (row.video.videoId)}
							<li>
								<button
									type="button"
									class="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-raised"
									onclick={() => playback.playIndex(row.index)}
								>
									<span class="relative w-20 shrink-0 overflow-hidden rounded border border-line/70">
										<img
											src={youtubeThumbnail(row.video.videoId)}
											alt=""
											class="aspect-video w-full object-cover"
											loading="lazy"
										/>
									</span>
									<span class="min-w-0 flex-1">
										<span class="line-clamp-2 text-[11px] leading-snug text-fg">{row.video.title}</span>
										<span class="mt-0.5 block font-mono text-[9px] text-comment">
											{formatRelative(row.video.publishedAt)}
										</span>
									</span>
									<Play size={12} class="shrink-0 text-comment" />
								</button>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		{:else}
			<div class="border-b border-line p-5 text-center">
				<VideoOff size={22} class="mx-auto text-comment" />
				<p class="mt-2 text-xs text-dim">No video is currently tuned.</p>
			</div>
		{/if}

		<section class="p-3">
			<div class="flex items-center justify-between gap-2">
				<p class="eyebrow">Full queue</p>
				<span class="font-mono text-[9px] text-comment">{queue.length} videos</span>
			</div>
			{#if queue.length === 0}
				<p class="mt-3 text-xs leading-relaxed text-dim">
					This channel has no cached videos yet. Refresh the feed below or ask the site operator to
					sync the catalog.
				</p>
			{:else}
				<ol class="mt-2 space-y-0.5">
					{#each queue as video, index (video.videoId)}
						{@const isCurrent = index === currentIndex}
						<li>
							<button
								type="button"
								class="flex w-full items-start gap-2 rounded px-1.5 py-1.5 text-left transition-colors {isCurrent
									? 'bg-raised text-fg'
									: 'text-dim hover:bg-raised/70 hover:text-fg'}"
								onclick={() => playback.playIndex(index)}
								aria-current={isCurrent ? 'true' : undefined}
							>
								<span class="mt-0.5 w-5 shrink-0 text-right font-mono text-[9px] text-comment tabular">
									{index + 1}
								</span>
								<span class="min-w-0 flex-1">
									<span class="line-clamp-2 text-[11px] leading-snug">{video.title}</span>
									<span class="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-comment">
										<span>{formatRelative(video.publishedAt)}</span>
										{#if video.availabilityStatus === 'unavailable'}
											<span class="text-red">unavailable</span>
										{/if}
									</span>
								</span>
								{#if isCurrent}
									<span class="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-red/20 text-red">
										<Radio size={9} />
									</span>
								{/if}
							</button>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>

	<footer class="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2.5">
		<span class="font-mono text-[9px] tracking-wide text-comment uppercase" title={snapshotLabel}>
			{snapshotLabel}
		</span>
		<button
			type="button"
			class="btn-ghost !px-2 !py-1 text-[10px]"
			disabled={refreshing}
			onclick={onrefresh}
			title="Refresh videos from YouTube RSS. A proxy may be required."
		>
			<RefreshCw size={12} class={refreshing ? 'animate-spin' : ''} />
			{refreshing ? 'Refreshing' : 'Refresh'}
		</button>
	</footer>
</aside>
