<script lang="ts">
	import { X, CheckCircle2, AlertTriangle, Info, CircleAlert } from '@lucide/svelte';
	import { toasts } from '#lib/stores/toast.svelte';

	const tones = {
		success: { icon: CheckCircle2, class: 'border-green/40 text-green' },
		error: { icon: CircleAlert, class: 'border-red/40 text-red' },
		warning: { icon: AlertTriangle, class: 'border-orange/40 text-orange' },
		info: { icon: Info, class: 'border-blue/40 text-blue' }
	};
</script>

<div class="pointer-events-none fixed right-3 bottom-3 z-50 flex w-[min(24rem,calc(100%-1.5rem))] flex-col gap-2">
	{#each toasts.items as toast (toast.id)}
		{@const tone = tones[toast.tone]}
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-lg border bg-raised/95 px-3.5 py-3 shadow-xl backdrop-blur {tone.class}"
			role="status"
		>
			<tone.icon size={17} class="mt-0.5 shrink-0" />
			<p class="min-w-0 flex-1 text-sm leading-relaxed text-fg">{toast.message}</p>
			<button
				type="button"
				class="text-comment transition-colors hover:text-fg"
				aria-label="Dismiss notification"
				onclick={() => toasts.dismiss(toast.id)}
			>
				<X size={15} />
			</button>
		</div>
	{/each}
</div>
