<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		type?: 'info' | 'warning' | 'error' | 'success';
		title?: string;
		message?: string;
		containerClass?: string;
		ariaLabel?: string;
		ariaLive?: 'off' | 'assertive' | 'polite' | null;
		role?: string;
		children?: Snippet;
	}

	let { type = 'info', title, message, containerClass = '', ariaLabel, ariaLive, role, children }: Props = $props();

	const bgClasses = {
		info: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800',
		warning: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800',
		error: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
		success: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
	};

	const textClasses = {
		info: 'text-blue-900 dark:text-blue-200',
		warning: 'text-yellow-900 dark:text-yellow-200',
		error: 'text-red-900 dark:text-red-200',
		success: 'text-green-900 dark:text-green-200'
	};
</script>

<div class={containerClass || `${bgClasses[type]} rounded-lg p-4`} role={role} aria-live={ariaLive} aria-label={ariaLabel}>
	{#if title}
		<h3 class={`font-semibold ${textClasses[type]} mb-1`}>{title}</h3>
	{/if}
	{#if message}
		<p class={`text-sm ${textClasses[type]}`}>{message}</p>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</div>
