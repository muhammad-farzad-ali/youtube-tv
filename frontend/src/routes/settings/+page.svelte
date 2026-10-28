<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Play,
		Rss,
		Palette,
		Hash,
		Database,
		Info,
		Download,
		Trash2,
		RefreshCw,
		CheckCircle2,
		CircleAlert,
		ExternalLink,
		RotateCcw,
		LoaderCircle
	} from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import { profile } from '#lib/stores/profile.svelte';
	import { catalog } from '#lib/stores/catalog.svelte';
	import { toasts } from '#lib/stores/toast.svelte';
	import { downloadProfile } from '#lib/features/profile/download';
	import { refreshChannels, summarizeRefresh } from '#lib/services/feedService';
	import { testFeedProxy, validateProxyUrl } from '#lib/services/rssClient';
	import {
		clearSyncStatus,
		clearVideos,
		estimateStorage,
		getTotalVideoCount,
		seedCatalogVideos
	} from '#lib/storage/database';
	import { APP_NAME, APP_VERSION } from '#lib/constants';
	import { formatBytes, formatDate } from '#lib/utils/format';

	let proxyDraft = $state(profile.settings.feedProxyUrl);
	let proxyBusy = $state(false);
	let proxyTest = $state<{ ok: boolean; message: string } | null>(null);
	let refreshing = $state(false);
	let resetOpen = $state(false);
	let clearOpen = $state(false);
	let videoCount = $state(0);
	let storage = $state<{ usage: number; quota: number } | null>(null);

	const proxyError = $derived(validateProxyUrl(proxyDraft));

	onMount(() => {
		void refreshStorage();
	});

	async function refreshStorage() {
		videoCount = await getTotalVideoCount();
		storage = await estimateStorage();
	}

	function saveProxy() {
		if (proxyError) {
			toasts.error(proxyError);
			return;
		}
		profile.setSetting('feedProxyUrl', proxyDraft.trim());
		toasts.success(proxyDraft.trim() ? 'Feed proxy saved.' : 'Feed proxy cleared.');
	}

	async function testProxy() {
		if (proxyError) {
			toasts.error(proxyError);
			return;
		}
		if (!proxyDraft.trim()) {
			toasts.warning('Enter a proxy URL first.');
			return;
		}
		proxyBusy = true;
		proxyTest = null;
		try {
			const result = await testFeedProxy(proxyDraft);
			proxyTest = {
				ok: true,
				message: `Connected to ${result.channelTitle} — ${result.videoCount} videos returned.`
			};
		} catch (cause) {
			proxyTest = {
				ok: false,
				message: cause instanceof Error ? cause.message : 'Proxy test failed.'
			};
		} finally {
			proxyBusy = false;
		}
	}

	async function refreshAll() {
		refreshing = true;
		try {
			const results = await refreshChannels(
				profile.lineup.map((entry) => entry.channelId),
				profile.settings.feedProxyUrl
			);
			const message = summarizeRefresh(results);
			if (results.some((result) => result.ok)) toasts.success(message);
			else toasts.error(message);
			await refreshStorage();
		} finally {
			refreshing = false;
		}
	}

	async function resetVideoCache() {
		if (!catalog.data) return;
		await clearVideos();
		await clearSyncStatus();
		await seedCatalogVideos(
			catalog.data,
			profile.lineup.map((entry) => entry.channelId)
		);
		clearOpen = false;
		await refreshStorage();
		toasts.success('Video cache reset to the bundled catalog snapshots.');
	}

	function resetEverything() {
		profile.resetProfile();
		resetOpen = false;
		toasts.success('Profile reset to the starter lineup.');
	}

	function backupBeforeReset() {
		const filename = downloadProfile(profile.exportFile('full'), 'full');
		toasts.success(`Backup downloaded: ${filename}`);
	}
</script>

<svelte:head>
	<title>Settings · Cable TV</title>
</svelte:head>

<div class="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
	<PageHeader
		eyebrow="Preferences"
		title="Settings"
		description="Playback behavior, feed access, appearance, numbering, and local storage. Everything stays in this browser."
	/>

	<div class="mt-6 space-y-5">
		<section class="panel overflow-hidden">
			<header class="flex items-center gap-3 border-b border-line px-4 py-3">
				<Play size={17} class="text-blue" />
				<div>
					<h2 class="font-display text-sm font-semibold tracking-wide text-fg">Playback</h2>
					<p class="text-xs text-comment">How the queue behaves when you tune a channel.</p>
				</div>
			</header>
			<div class="grid gap-4 p-4 sm:grid-cols-2">
				<Toggle
					checked={profile.settings.autoplayNext}
					label="Autoplay next"
					description="Advance to the next older video when one ends."
					onchange={(value) => profile.setSetting('autoplayNext', value)}
				/>
				<Toggle
					checked={profile.settings.skipUnavailable}
					label="Skip unavailable"
					description="Automatically skip private, removed, or non-embeddable videos."
					onchange={(value) => profile.setSetting('skipUnavailable', value)}
				/>
				<Toggle
					checked={profile.settings.loopQueue}
					label="Loop queue"
					description="Start over at the first video in the queue after the last one finishes."
					onchange={(value) => profile.setSetting('loopQueue', value)}
				/>
				<Toggle
					checked={profile.settings.startOnSelect}
					label="Start on channel select"
					description="Begin playback immediately when you switch channels."
					onchange={(value) => profile.setSetting('startOnSelect', value)}
				/>
				<Toggle
					checked={profile.settings.startMuted}
					label="Start muted"
					description="Improves autoplay reliability. Unmute from the player controls."
					onchange={(value) => profile.setSetting('startMuted', value)}
				/>
				<Toggle
					checked={profile.settings.resumeLastVideo}
					label="Resume last video"
					description="Start a channel from the last video you watched, not mid-video."
					onchange={(value) => profile.setSetting('resumeLastVideo', value)}
				/>
				<label class="block sm:col-span-2">
					<span class="label">Queue order</span>
					<select
						class="select"
						value={profile.settings.sortOrder}
						onchange={(event) =>
							profile.setSetting(
								'sortOrder',
								event.currentTarget.value === 'oldest' ? 'oldest' : 'newest'
							)}
					>
						<option value="newest">Newest first (recommended)</option>
						<option value="oldest">Oldest first</option>
					</select>
				</label>
			</div>
		</section>

		<section class="panel overflow-hidden">
			<header class="flex items-center gap-3 border-b border-line px-4 py-3">
				<Rss size={17} class="text-green" />
				<div>
					<h2 class="font-display text-sm font-semibold tracking-wide text-fg">
						Feeds &amp; refresh
					</h2>
					<p class="text-xs text-comment">
						The catalog snapshot always works. Live refresh needs a proxy.
					</p>
				</div>
			</header>
			<div class="space-y-4 p-4">
				<div
					class="rounded-lg border border-orange/30 bg-orange/10 p-3 text-xs leading-relaxed text-orange"
				>
					YouTube does not send CORS headers on its RSS feeds, so browsers block direct requests.
					The bundled snapshots are the reliable default. If you want live refresh, point the app at
					your own CORS-enabled feed proxy.
				</div>

				<label class="block">
					<span class="label">Feed proxy URL</span>
					<input
						class="input font-mono text-xs"
						type="url"
						bind:value={proxyDraft}
						placeholder={'https://your-worker.example/?url={url}'}
						spellcheck="false"
					/>
					<span class="mt-1 block text-xs text-comment">
						Use <code class="text-cyan">{'{url}'}</code> where the encoded YouTube feed URL should go.
						The proxy sees requested channel feed URLs. No key is stored by this app.
					</span>
					{#if proxyError}
						<span class="mt-1 block text-xs text-red">{proxyError}</span>
					{/if}
				</label>

				<div class="flex flex-wrap items-center gap-2">
					<button type="button" class="btn-primary" onclick={saveProxy}>
						<CheckCircle2 size={15} />
						Save proxy
					</button>
					<button type="button" class="btn-secondary" disabled={proxyBusy} onclick={testProxy}>
						{#if proxyBusy}<LoaderCircle size={15} class="animate-spin" />{:else}<Rss
								size={15}
							/>{/if}
						Test proxy
					</button>
					<button type="button" class="btn-secondary" disabled={refreshing} onclick={refreshAll}>
						<RefreshCw size={15} class={refreshing ? 'animate-spin' : ''} />
						Refresh selected
					</button>
				</div>

				{#if proxyTest}
					<div
						class="flex items-start gap-2 rounded-md border px-3 py-2 text-xs {proxyTest.ok
							? 'border-green/30 bg-green/10 text-green'
							: 'border-red/30 bg-red/10 text-red'}"
					>
						{#if proxyTest.ok}<CheckCircle2 size={14} class="mt-0.5" />{:else}<CircleAlert
								size={14}
								class="mt-0.5"
							/>{/if}
						{proxyTest.message}
					</div>
				{/if}

				<label class="block">
					<span class="label">Automatic refresh while open</span>
					<select
						class="select"
						value={String(profile.settings.autoRefreshMinutes)}
						onchange={(event) =>
							profile.setSetting('autoRefreshMinutes', Number(event.currentTarget.value))}
					>
						<option value="0">Off</option>
						<option value="15">Every 15 minutes</option>
						<option value="30">Every 30 minutes</option>
						<option value="60">Every hour</option>
						<option value="120">Every 2 hours</option>
					</select>
					<span class="mt-1 block text-xs text-comment">
						Only runs while the tab is visible and a proxy is configured. It never runs in the
						background after the page is closed.
					</span>
				</label>
			</div>
		</section>

		<section class="panel overflow-hidden">
			<header class="flex items-center gap-3 border-b border-line px-4 py-3">
				<Palette size={17} class="text-magenta" />
				<div>
					<h2 class="font-display text-sm font-semibold tracking-wide text-fg">Appearance</h2>
					<p class="text-xs text-comment">Tokyo Night is the fixed theme.</p>
				</div>
			</header>
			<div class="grid gap-4 p-4 sm:grid-cols-2">
				<Toggle
					checked={profile.settings.crtEffects}
					label="CRT scanlines"
					description="Subtle scanline overlay on the player. Reduced-motion preferences still win."
					onchange={(value) => profile.setSetting('crtEffects', value)}
				/>
				<div class="rounded-md border border-line bg-ink p-3">
					<p class="eyebrow">Palette</p>
					<div class="mt-2 flex gap-1.5">
						<span class="size-5 rounded-sm bg-blue" title="Blue #7aa2f7"></span>
						<span class="size-5 rounded-sm bg-cyan" title="Cyan #7dcfff"></span>
						<span class="size-5 rounded-sm bg-green" title="Green #9ece6a"></span>
						<span class="size-5 rounded-sm bg-yellow" title="Yellow #e0af68"></span>
						<span class="size-5 rounded-sm bg-orange" title="Orange #ff9e64"></span>
						<span class="size-5 rounded-sm bg-red" title="Red #f7768e"></span>
						<span class="size-5 rounded-sm bg-magenta" title="Magenta #bb9af7"></span>
					</div>
					<p class="mt-2 text-xs text-dim">Tokyo Night by Enkia</p>
				</div>
			</div>
		</section>

		<section class="panel overflow-hidden">
			<header class="flex items-center gap-3 border-b border-line px-4 py-3">
				<Hash size={17} class="text-yellow" />
				<div>
					<h2 class="font-display text-sm font-semibold tracking-wide text-fg">
						Channel numbering
					</h2>
					<p class="text-xs text-comment">Numbers follow your lineup order.</p>
				</div>
			</header>
			<div class="p-4">
				<label class="block max-w-xs">
					<span class="label">First channel number</span>
					<input
						class="input"
						type="number"
						min="1"
						max="9999"
						value={profile.settings.numberStart}
						onchange={(event) => {
							const value = Number(event.currentTarget.value);
							if (Number.isFinite(value) && value >= 1 && value <= 9999) {
								profile.setSetting('numberStart', Math.round(value));
							}
						}}
					/>
					<span class="mt-1 block text-xs text-comment">
						The sequence is reassigned when you reorder your lineup.
					</span>
				</label>
			</div>
		</section>

		<section class="panel overflow-hidden">
			<header class="flex items-center gap-3 border-b border-line px-4 py-3">
				<Database size={17} class="text-cyan" />
				<div>
					<h2 class="font-display text-sm font-semibold tracking-wide text-fg">
						Storage &amp; data
					</h2>
					<p class="text-xs text-comment">
						Browser storage is local and can be cleared by the browser.
					</p>
				</div>
			</header>
			<div class="space-y-4 p-4">
				<div class="grid gap-3 sm:grid-cols-3">
					<div class="rounded-md border border-line bg-ink p-3">
						<p class="eyebrow">Profile</p>
						<p class="mt-1 font-display text-lg font-semibold text-fg">
							{profile.lineup.length} channels
						</p>
					</div>
					<div class="rounded-md border border-line bg-ink p-3">
						<p class="eyebrow">Cached videos</p>
						<p class="mt-1 font-display text-lg font-semibold text-fg">{videoCount}</p>
					</div>
					<div class="rounded-md border border-line bg-ink p-3">
						<p class="eyebrow">Storage used</p>
						<p class="mt-1 font-display text-lg font-semibold text-fg">
							{storage ? formatBytes(storage.usage) : '—'}
						</p>
					</div>
				</div>

				{#if profile.storageError}
					<div class="rounded-md border border-red/30 bg-red/10 px-3 py-2 text-xs text-red">
						Your browser could not save the profile: {profile.storageError}
					</div>
				{/if}

				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="btn-secondary"
						onclick={() => {
							const filename = downloadProfile(profile.exportFile('full'), 'full');
							toasts.success(`Backup downloaded: ${filename}`);
						}}
					>
						<Download size={15} />
						Download backup
					</button>
					<button type="button" class="btn-secondary" onclick={() => (clearOpen = true)}>
						<RefreshCw size={15} />
						Reset video cache
					</button>
					<button type="button" class="btn-danger" onclick={() => (resetOpen = true)}>
						<Trash2 size={15} />
						Reset profile
					</button>
				</div>
			</div>
		</section>

		<section class="panel overflow-hidden">
			<header class="flex items-center gap-3 border-b border-line px-4 py-3">
				<Info size={17} class="text-comment" />
				<div>
					<h2 class="font-display text-sm font-semibold tracking-wide text-fg">About</h2>
					<p class="text-xs text-comment">{APP_NAME} {APP_VERSION}</p>
				</div>
			</header>
			<div class="space-y-3 p-4 text-xs leading-relaxed text-dim">
				<p>
					Catalog updated {formatDate(catalog.data?.updatedAt)} with
					{catalog.channels.length} managed channels across {catalog.categories.length} categories. Channels
					are curated by the site operator; your lineup and settings stay in this browser.
				</p>
				<p>
					YouTube RSS only exposes recent uploads, usually around 15 per channel. Some videos cannot
					be embedded due to privacy, age, region, or owner settings. Browser storage can be cleared
					at any time, so keep a profile backup.
				</p>
				<p>
					Theme: <span class="text-fg">Tokyo Night</span> by Enkia ·
					<a
						class="inline-flex items-center gap-1 text-cyan hover:underline"
						href="https://tokyonight.org/"
						target="_blank"
						rel="noopener noreferrer">tokyonight.org <ExternalLink size={11} /></a
					>
				</p>
			</div>
		</section>
	</div>
</div>

<Modal
	open={resetOpen}
	title="Reset profile?"
	description="This removes your local lineup, favorites, playback settings, and last-played history. Cached videos will also be cleared."
	onclose={() => (resetOpen = false)}
>
	<p class="text-sm leading-relaxed text-dim">
		Download a backup first if you might want to restore this lineup later. The app will return to
		the site operator's starter lineup.
	</p>
	{#snippet footer()}
		<button type="button" class="btn-ghost" onclick={() => (resetOpen = false)}>Cancel</button>
		<button type="button" class="btn-secondary" onclick={backupBeforeReset}>
			<Download size={15} />
			Backup first
		</button>
		<button
			type="button"
			class="btn-danger"
			onclick={async () => {
				await clearVideos();
				await clearSyncStatus();
				resetEverything();
			}}
		>
			Reset everything
		</button>
	{/snippet}
</Modal>

<Modal
	open={clearOpen}
	title="Reset video cache?"
	description="This replaces locally refreshed videos with the bundled catalog snapshots for your selected channels."
	onclose={() => (clearOpen = false)}
>
	<p class="text-sm leading-relaxed text-dim">
		Your lineup and settings are not affected. Any live feed data in this browser will be discarded.
	</p>
	{#snippet footer()}
		<button type="button" class="btn-ghost" onclick={() => (clearOpen = false)}>Cancel</button>
		<button type="button" class="btn-primary" onclick={resetVideoCache}>
			<RotateCcw size={15} />
			Reset cache
		</button>
	{/snippet}
</Modal>
