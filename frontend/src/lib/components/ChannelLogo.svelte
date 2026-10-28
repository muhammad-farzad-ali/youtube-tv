<script lang="ts">
	import { channelLogo } from '#lib/utils/assets';
	import { hashCode, initials } from '#lib/utils/format';

	interface Props {
		channel: { id: string; name: string; logoUrl?: string };
		size?: 'sm' | 'md' | 'lg' | 'xl';
		class?: string;
	}

	let { channel, size = 'md', class: className = '' }: Props = $props();
	let failed = $state(false);
	let src = $derived(channelLogo(channel));
	let hue = $derived(hashCode(channel.id) % 360);

	$effect(() => {
		void src;
		failed = false;
	});

	const sizes = {
		sm: 'size-7 rounded text-[10px]',
		md: 'size-9 rounded-md text-xs',
		lg: 'size-12 rounded-md text-sm',
		xl: 'size-16 rounded-lg text-lg'
	};
</script>

<div
	class="relative flex shrink-0 items-center justify-center overflow-hidden border border-line/80 bg-raised font-display font-semibold tracking-wide text-fg {sizes[
		size
	]} {className}"
	style:--mono-hue={hue}
	aria-hidden="true"
>
	{#if src && !failed}
		<img
			{src}
			alt=""
			class="size-full object-cover"
			loading="lazy"
			onerror={() => (failed = true)}
		/>
	{:else}
		<span
			class="flex size-full items-center justify-center"
			style="background: linear-gradient(140deg, hsl(var(--mono-hue) 45% 30%), hsl(calc(var(--mono-hue) + 55) 50% 20%));"
		>
			{initials(channel.name) || 'TV'}
		</span>
	{/if}
</div>
