<script lang="ts">
	import {
		Download,
		Upload,
		FileJson,
		ShieldCheck,
		TriangleAlert,
		ArrowRight,
		ListVideo,
		Settings2,
		X,
		CheckCircle2,
		Database
	} from '@lucide/svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import { profile } from '#lib/stores/profile.svelte';
	import { catalog } from '#lib/stores/catalog.svelte';
	import { toasts } from '#lib/stores/toast.svelte';
	import { downloadProfile } from '#lib/features/profile/download';
	import { profileFileSchema, type ProfileFile } from '#lib/schemas/profile.schema';
	import { formatDate } from '#lib/utils/format';

	interface ImportPreview {
		filename: string;
		file: ProfileFile;
		unknown: string[];
		added: number;
		removed: number;
		favoriteChanges: number;
		settingsPresent: boolean;
	}

	let dragging = $state(false);
	let importing = $state(false);
	let preview = $state<ImportPreview | null>(null);
	let parseError = $state<string | null>(null);
	let mode = $state<'merge' | 'replace'>('merge');
	let applySettings = $state(false);
	let skipUnknown = $state(true);
	let fileInput: HTMLInputElement | null = $state(null);

	const currentIds = $derived(new Set(profile.lineup.map((entry) => entry.channelId)));

	async function readFile(file: File) {
		parseError = null;
		preview = null;
		if (file.size > 5 * 1024 * 1024) {
			parseError = 'That file is larger than 5 MB. Profile backups should be tiny.';
			return;
		}

		let raw: unknown;
		try {
			raw = JSON.parse(await file.text());
		} catch {
			parseError = 'The selected file is not valid JSON.';
			return;
		}

		if (
			typeof raw === 'object' &&
			raw !== null &&
			'type' in raw &&
			(raw as { type?: string }).type === 'cable-tv-catalog'
		) {
			parseError =
				'This is a catalog file. Channels are managed by the site operator and cannot be imported into the app.';
			return;
		}

		const parsed = profileFileSchema.safeParse(raw);
		if (!parsed.success) {
			const issues = parsed.error.issues
				.slice(0, 4)
				.map((issue) => `${issue.path.join('.') || 'file'}: ${issue.message}`);
			parseError = `Invalid profile backup. ${issues.join(' · ')}`;
			return;
		}

		const known = new Set(catalog.channels.map((channel) => channel.id));
		const incoming = parsed.data.lineup;
		const incomingIds = new Set(incoming.map((entry) => entry.channelId));
		const unknown = incoming
			.filter((entry) => !known.has(entry.channelId))
			.map((entry) => entry.channelId);
		const currentFavorites = new Map(
			profile.lineup.map((entry) => [entry.channelId, entry.favorite])
		);
		const favoriteChanges = incoming.filter(
			(entry) =>
				currentFavorites.has(entry.channelId) &&
				currentFavorites.get(entry.channelId) !== entry.favorite
		).length;

		preview = {
			filename: file.name,
			file: parsed.data,
			unknown,
			added: [...incomingIds].filter((id) => !currentIds.has(id)).length,
			removed: [...currentIds].filter((id) => !incomingIds.has(id)).length,
			favoriteChanges,
			settingsPresent: parsed.data.settings !== null
		};
		mode = 'merge';
		applySettings = parsed.data.settings !== null;
		skipUnknown = true;
	}

	function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void readFile(file);
		input.value = '';
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) void readFile(file);
	}

	function clearImport() {
		preview = null;
		parseError = null;
		if (fileInput) fileInput.value = '';
	}

	function exportProfile(kind: 'full' | 'lineup' | 'settings') {
		const filename = downloadProfile(profile.exportFile(kind), kind);
		toasts.success(`Downloaded ${filename}`);
	}

	function applyImport() {
		if (!preview) return;
		importing = true;
		try {
			const result = profile.applyImportedProfile(preview.file, mode, {
				applySettings,
				skipUnknown
			});
			if (result.unknown.length > 0 && !skipUnknown) {
				toasts.error(
					'This backup contains channels outside the managed catalog. Enable “skip unknown”.'
				);
				return;
			}
			toasts.success(
				`Import applied — ${result.added} added, ${result.removed} removed` +
					(result.unknown.length ? `, ${result.unknown.length} unknown skipped.` : '.')
			);
			clearImport();
		} finally {
			importing = false;
		}
	}
</script>

<svelte:head>
	<title>Backup · Cable TV</title>
</svelte:head>

<div class="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
	<PageHeader
		eyebrow="Portable profile"
		title="Backup &amp; restore"
		description="Export your lineup, favorites, and playback settings as JSON. Import them on another browser or restore after clearing site data. Channel definitions are managed by the site operator and are never imported."
	/>

	<div class="mt-6 grid gap-5 lg:grid-cols-2">
		<section class="panel overflow-hidden">
			<header class="flex items-center gap-3 border-b border-line px-4 py-3">
				<Download size={17} class="text-blue" />
				<div>
					<h2 class="font-display text-sm font-semibold tracking-wide text-fg">Export</h2>
					<p class="text-xs text-comment">Downloads a versioned JSON profile.</p>
				</div>
			</header>
			<div class="space-y-3 p-4">
				<div class="rounded-md border border-line bg-ink p-3">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="flex items-center gap-2 font-display text-sm font-semibold text-fg">
								<Database size={15} class="text-cyan" />
								Full profile
							</p>
							<p class="mt-1 text-xs leading-relaxed text-dim">
								{profile.lineup.length} channels, favorites, queue order, playback and feed settings.
							</p>
						</div>
						<button
							type="button"
							class="btn-primary shrink-0"
							onclick={() => exportProfile('full')}
						>
							Export
						</button>
					</div>
				</div>

				<div class="rounded-md border border-line bg-ink p-3">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="flex items-center gap-2 font-display text-sm font-semibold text-fg">
								<ListVideo size={15} class="text-blue" />
								Lineup only
							</p>
							<p class="mt-1 text-xs leading-relaxed text-dim">
								Selected channels and favorites without settings.
							</p>
						</div>
						<button
							type="button"
							class="btn-secondary shrink-0"
							onclick={() => exportProfile('lineup')}
						>
							Export
						</button>
					</div>
				</div>

				<div class="rounded-md border border-line bg-ink p-3">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="flex items-center gap-2 font-display text-sm font-semibold text-fg">
								<Settings2 size={15} class="text-magenta" />
								Settings only
							</p>
							<p class="mt-1 text-xs leading-relaxed text-dim">
								Playback, feed proxy, appearance, numbering, and last-played history.
							</p>
						</div>
						<button
							type="button"
							class="btn-secondary shrink-0"
							onclick={() => exportProfile('settings')}
						>
							Export
						</button>
					</div>
				</div>

				<p class="flex items-start gap-2 text-xs leading-relaxed text-comment">
					<ShieldCheck size={14} class="mt-0.5 shrink-0 text-green" />
					Files are generated locally. Nothing is uploaded to a server. Store the JSON somewhere safe
					— clearing browser data removes the live copy.
				</p>
			</div>
		</section>

		<section class="panel overflow-hidden">
			<header class="flex items-center gap-3 border-b border-line px-4 py-3">
				<Upload size={17} class="text-green" />
				<div>
					<h2 class="font-display text-sm font-semibold tracking-wide text-fg">Import</h2>
					<p class="text-xs text-comment">Validated before anything changes.</p>
				</div>
			</header>
			<div class="space-y-3 p-4">
				<div
					class="rounded-lg border border-dashed px-5 py-8 text-center transition-colors {dragging
						? 'border-cyan bg-cyan/5'
						: 'border-line bg-ink'}"
					role="button"
					tabindex="0"
					onclick={() => fileInput?.click()}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') fileInput?.click();
					}}
					ondragover={(event) => {
						event.preventDefault();
						dragging = true;
					}}
					ondragleave={() => (dragging = false)}
					ondrop={onDrop}
				>
					<FileJson size={26} class="mx-auto text-comment" />
					<p class="mt-3 font-display text-sm font-semibold text-fg">Drop a profile JSON here</p>
					<p class="mt-1 text-xs text-dim">or click to choose a file</p>
					<p class="mt-2 font-mono text-[9px] tracking-wide text-comment uppercase">
						cable-tv-profile · schema v1 · max 5 MB
					</p>
					<input
						bind:this={fileInput}
						class="hidden"
						type="file"
						accept="application/json,.json"
						onchange={onFileChange}
					/>
				</div>

				{#if parseError}
					<div
						class="flex items-start gap-2 rounded-md border border-red/30 bg-red/10 px-3 py-2 text-xs leading-relaxed text-red"
					>
						<TriangleAlert size={14} class="mt-0.5 shrink-0" />
						{parseError}
					</div>
				{/if}

				{#if preview}
					<div class="rounded-lg border border-line bg-ink p-3">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="truncate font-mono text-xs text-cyan">{preview.filename}</p>
								<p class="mt-0.5 text-xs text-comment">
									Exported {formatDate(preview.file.exportedAt)} · {preview.file.lineup.length}
									channels
								</p>
							</div>
							<button
								type="button"
								class="btn-icon !size-7"
								aria-label="Clear import"
								onclick={clearImport}
							>
								<X size={14} />
							</button>
						</div>

						<div class="mt-3 grid grid-cols-3 gap-2 text-center">
							<div class="rounded border border-green/30 bg-green/5 p-2">
								<p class="font-display text-lg font-semibold text-green">{preview.added}</p>
								<p class="font-mono text-[9px] tracking-wide text-comment uppercase">New</p>
							</div>
							<div class="rounded border border-orange/30 bg-orange/5 p-2">
								<p class="font-display text-lg font-semibold text-orange">{preview.removed}</p>
								<p class="font-mono text-[9px] tracking-wide text-comment uppercase">Not in file</p>
							</div>
							<div class="rounded border border-line bg-surface p-2">
								<p class="font-display text-lg font-semibold text-fg">{preview.favoriteChanges}</p>
								<p class="font-mono text-[9px] tracking-wide text-comment uppercase">Fav changes</p>
							</div>
						</div>

						{#if preview.unknown.length > 0}
							<div
								class="mt-3 rounded-md border border-yellow/30 bg-yellow/10 p-2.5 text-xs text-yellow"
							>
								<p class="font-medium">
									{preview.unknown.length} channel(s) are not in the current catalog:
								</p>
								<ul class="mt-1 list-inside list-disc font-mono text-[10px]">
									{#each preview.unknown.slice(0, 4) as id (id)}
										<li>{id}</li>
									{/each}
									{#if preview.unknown.length > 4}
										<li>and {preview.unknown.length - 4} more…</li>
									{/if}
								</ul>
							</div>
						{/if}

						<div class="mt-3 grid grid-cols-2 gap-2">
							<button
								type="button"
								class="rounded-md border p-2.5 text-left text-xs transition-colors {mode === 'merge'
									? 'border-blue/60 bg-blue/10 text-fg'
									: 'border-line bg-surface text-dim hover:bg-raised'}"
								aria-pressed={mode === 'merge'}
								onclick={() => (mode = 'merge')}
							>
								<span class="font-display font-semibold">Merge</span>
								<span class="mt-0.5 block text-[10px] text-comment">Keep current, add new</span>
							</button>
							<button
								type="button"
								class="rounded-md border p-2.5 text-left text-xs transition-colors {mode ===
								'replace'
									? 'border-red/60 bg-red/10 text-fg'
									: 'border-line bg-surface text-dim hover:bg-raised'}"
								aria-pressed={mode === 'replace'}
								onclick={() => (mode = 'replace')}
							>
								<span class="font-display font-semibold">Replace</span>
								<span class="mt-0.5 block text-[10px] text-comment">Use file lineup exactly</span>
							</button>
						</div>

						{#if mode === 'replace'}
							<div
								class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-orange/30 bg-orange/10 px-2.5 py-2 text-xs text-orange"
							>
								<span>This replaces your current lineup.</span>
								<button
									type="button"
									class="btn-ghost !px-2 !py-1 text-[10px]"
									onclick={() => exportProfile('full')}
								>
									Download backup first
								</button>
							</div>
						{/if}

						<div class="mt-3 space-y-3 border-t border-line pt-3">
							<Toggle
								checked={skipUnknown}
								label="Skip unknown channels"
								description="Ignore IDs that are no longer in the managed catalog."
								onchange={(value) => (skipUnknown = value)}
							/>
							{#if preview.settingsPresent}
								<Toggle
									checked={applySettings}
									label="Apply settings from file"
									description="Playback, feed, appearance, numbering, and resume history."
									onchange={(value) => (applySettings = value)}
								/>
							{/if}
						</div>

						<button
							type="button"
							class="btn-primary mt-3 w-full"
							disabled={importing || (!skipUnknown && preview.unknown.length > 0)}
							onclick={applyImport}
						>
							{#if importing}
								Applying…
							{:else}
								<CheckCircle2 size={15} />
								Apply {mode === 'replace' ? 'and replace lineup' : 'import'}
								<ArrowRight size={14} />
							{/if}
						</button>
					</div>
				{/if}
			</div>
		</section>
	</div>

	<section class="panel mt-5 overflow-hidden">
		<header class="border-b border-line px-4 py-3">
			<h2 class="font-display text-sm font-semibold tracking-wide text-fg">
				What is in a profile?
			</h2>
		</header>
		<div class="grid gap-4 p-4 text-xs leading-relaxed text-dim sm:grid-cols-3">
			<div>
				<p class="eyebrow text-blue">Portable</p>
				<p class="mt-1">Channel IDs, lineup order, favorites, and selected channel.</p>
			</div>
			<div>
				<p class="eyebrow text-magenta">Preferences</p>
				<p class="mt-1">
					Playback behavior, feed proxy, numbering, CRT effects, volume, and resume history.
				</p>
			</div>
			<div>
				<p class="eyebrow text-yellow">Not included</p>
				<p class="mt-1">
					Channel definitions, logos, catalog snapshots, or arbitrary YouTube URLs.
				</p>
			</div>
		</div>
	</section>
</div>
