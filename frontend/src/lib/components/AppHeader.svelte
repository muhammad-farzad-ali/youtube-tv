<script lang="ts">
	import { resolve } from '$app/paths';
	import { Radio } from '@lucide/svelte';
	import Clock from './Clock.svelte';
	import { catalog } from '#lib/stores/catalog.svelte';
</script>

<header class="sticky top-0 z-30 border-b border-line/80 bg-bg/90 backdrop-blur-md">
	<div class="flex h-16 items-center gap-3 px-3 sm:px-5">
		<a
			href={resolve('/')}
			class="group flex min-w-0 items-center gap-2.5"
			aria-label="Cable TV home"
		>
			<span
				class="flex size-9 items-center justify-center rounded-md border border-blue/40 bg-blue/10 text-blue transition-colors group-hover:border-cyan/60 group-hover:text-cyan"
			>
				<Radio size={19} />
			</span>
			<span class="hidden min-w-0 leading-none sm:block">
				<span class="block font-display text-base font-bold tracking-[0.18em] text-fg">
					CABLE<span class="text-red">TV</span>
				</span>
				<span class="mt-1 block font-mono text-[9px] tracking-[0.24em] text-comment uppercase">
					Lite · Tokyo Night
				</span>
			</span>
		</a>

		<div class="ml-auto flex items-center gap-3">
			<div class="hidden items-center gap-2 sm:flex">
				<span class="chip">
					<span class="size-1.5 rounded-full bg-green"></span>
					{catalog.channels.length} channels
				</span>
				<span class="chip border-blue/30 text-blue">admin curated</span>
			</div>
			<span class="hidden h-5 w-px bg-line sm:block"></span>
			<Clock />
		</div>
	</div>
</header>
