<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Tv, ListVideo, ArrowDownUp, Settings, Radio } from '@lucide/svelte';
	import Clock from './Clock.svelte';
	import { catalog } from '#lib/stores/catalog.svelte';
	import { profile } from '#lib/stores/profile.svelte';

	const nav = [
		{ href: '/', label: 'TV', icon: Tv },
		{ href: '/lineup', label: 'Lineup', icon: ListVideo },
		{ href: '/import-export', label: 'Backup', icon: ArrowDownUp },
		{ href: '/settings', label: 'Settings', icon: Settings }
	] as const;

	const pathname = $derived(page.url.pathname.replace(/\/+$/, '') || '/');
</script>

<header class="sticky top-0 z-30 border-b border-line/80 bg-bg/90 backdrop-blur-md">
	<div class="flex h-16 items-center gap-3 px-3 sm:px-5">
		<a href={resolve('/')} class="group flex min-w-0 items-center gap-2.5" aria-label="Cable TV home">
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
					Tokyo Night
				</span>
			</span>
		</a>

		<nav class="ml-2 hidden items-center gap-1 md:flex" aria-label="Main navigation">
			{#each nav as item (item.href)}
				{@const active = item.href === '/' ? pathname === '/' : pathname === item.href}
				<a
					href={resolve(item.href)}
					class="flex items-center gap-2 rounded-md px-3 py-2 font-display text-sm font-medium tracking-wide transition-colors {active
						? 'bg-raised text-fg shadow-[inset_0_0_0_1px] shadow-line'
						: 'text-dim hover:bg-raised/70 hover:text-fg'}"
					aria-current={active ? 'page' : undefined}
				>
					<item.icon size={15} class={active ? 'text-cyan' : ''} />
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-3">
			<div class="hidden items-center gap-2 sm:flex">
				<span class="chip">
					<span class="size-1.5 rounded-full bg-green"></span>
					{catalog.channels.length} channels
				</span>
				<span class="chip">
					<span class="size-1.5 rounded-full bg-blue"></span>
					{profile.lineup.length} in lineup
				</span>
			</div>
			<span class="hidden h-5 w-px bg-line sm:block"></span>
			<Clock />
		</div>
	</div>
</header>

<nav
	class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur-md md:hidden"
	aria-label="Main navigation"
>
	{#each nav as item (item.href)}
		{@const active = item.href === '/' ? pathname === '/' : pathname === item.href}
		<a
			href={resolve(item.href)}
			class="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium tracking-wide transition-colors {active
				? 'text-cyan'
				: 'text-comment hover:text-dim'}"
			aria-current={active ? 'page' : undefined}
		>
			<item.icon size={18} />
			{item.label}
		</a>
	{/each}
</nav>
