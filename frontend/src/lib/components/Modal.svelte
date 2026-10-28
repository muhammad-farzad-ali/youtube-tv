<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		children: Snippet;
		footer?: Snippet;
		onclose: () => void;
		wide?: boolean;
	}

	let { open, title, description, children, footer, onclose, wide = false }: Props = $props();
	let dialog: HTMLDialogElement | null = $state(null);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function handleClose() {
		onclose();
	}

	function backdropClick(event: MouseEvent) {
		if (event.target === dialog) onclose();
	}
</script>

<dialog
	bind:this={dialog}
	class="m-auto max-h-[88dvh] w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-line bg-raised p-0 text-fg shadow-2xl backdrop:bg-ink/80 backdrop:backdrop-blur-sm {wide
		? 'max-w-3xl'
		: 'max-w-lg'}"
	onclose={handleClose}
	onclick={backdropClick}
>
	{#if open}
		<div class="flex max-h-[88dvh] flex-col">
			<header class="flex items-start gap-4 border-b border-line px-5 py-4">
				<div class="min-w-0 flex-1">
					<h2 class="font-display text-lg font-semibold tracking-wide text-fg">{title}</h2>
					{#if description}
						<p class="mt-1 text-sm leading-relaxed text-dim">{description}</p>
					{/if}
				</div>
				<button class="btn-icon" type="button" aria-label="Close dialog" onclick={onclose}>
					<X size={17} />
				</button>
			</header>
			<div class="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
				{@render children()}
			</div>
			{#if footer}
				<footer class="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
					{@render footer()}
				</footer>
			{/if}
		</div>
	{/if}
</dialog>
