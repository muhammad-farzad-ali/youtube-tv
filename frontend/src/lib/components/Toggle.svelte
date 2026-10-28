<script lang="ts">
	interface Props {
		checked: boolean;
		label: string;
		description?: string;
		onchange: (checked: boolean) => void;
		disabled?: boolean;
	}

	let { checked, label, description, onchange, disabled = false }: Props = $props();
</script>

<label class="flex cursor-pointer items-start gap-3 {disabled ? 'opacity-50' : ''}">
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={label}
		{disabled}
		class="relative mt-0.5 h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors {checked
			? 'border-blue bg-blue'
			: 'border-line bg-ink'}"
		onclick={() => onchange(!checked)}
	>
		<span
			class="absolute top-0.5 size-3.5 rounded-full transition-transform {checked
				? 'translate-x-[18px] bg-ink'
				: 'translate-x-0.5 bg-comment'}"
		></span>
	</button>
	<span class="min-w-0">
		<span class="block text-sm font-medium text-fg">{label}</span>
		{#if description}
			<span class="mt-0.5 block text-xs leading-relaxed text-dim">{description}</span>
		{/if}
	</span>
</label>
