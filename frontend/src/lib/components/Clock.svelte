<script lang="ts">
	import { onMount } from 'svelte';
	import { formatClock } from '#lib/utils/format';

	let now = $state(new Date());

	onMount(() => {
		const interval = setInterval(() => (now = new Date()), 15_000);
		return () => clearInterval(interval);
	});
</script>

<span class="font-mono text-xs tracking-widest text-dim tabular" aria-label="Current time">
	{formatClock(now)}
</span>
