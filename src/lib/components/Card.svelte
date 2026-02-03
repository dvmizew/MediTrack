<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	interface Props {
		title?: string;
		value?: string | number;
		sub?: string;
		accent?: string;
		icon?: Component<any>;
		iconColor?: string;
		iconBg?: string;
		ariaLabel?: string;
		ariaLive?: 'off' | 'assertive' | 'polite' | null;
		role?: string;
		containerClass?: string;
		renderCustom?: boolean;
		href?: string;
		target?: string;
		rel?: string;
		children?: Snippet;
		unstyled?: boolean;
	}

	let { title, value, sub = '', accent = 'text-gray-900 dark:text-slate-100', icon: Icon, iconColor = 'text-gray-500 dark:text-slate-300', iconBg = 'bg-gray-100 dark:bg-slate-800/40', ariaLabel, ariaLive, role, containerClass = '', renderCustom = false, href, target, rel, children, unstyled = false }: Props = $props();

	const computedAriaLabel = $derived(ariaLabel ?? (title && value !== undefined ? `${title}: ${value}${sub ? `, ${sub}` : ''}` : undefined));
	const wrapperTag = $derived(href ? 'a' : 'div');
</script>

	<svelte:element
		this={wrapperTag}
		class={`${unstyled ? '' : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 md:p-5 shadow-sm dark:shadow-lg hover:shadow-md dark:hover:shadow-xl transition h-full flex flex-col justify-between'} ${containerClass}`}
		role={role ?? (href ? undefined : 'region')}
		aria-label={computedAriaLabel}
		aria-live={ariaLive}
		href={href}
		target={target}
		rel={rel}
	>
		{#if renderCustom}
			{@render children?.()}
		{:else}
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-gray-700 dark:text-slate-300 mb-1">{title}</p>
					<p class={`text-2xl md:text-3xl font-bold ${accent}`}>{value}</p>
					{#if sub}
						<p class="text-xs text-gray-600 dark:text-slate-400 mt-1">{sub}</p>
					{/if}
				</div>
				{#if Icon}
					<div class={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center`}>
						<Icon class={`w-6 h-6 ${iconColor}`} />
					</div>
				{/if}
			</div>
		{/if}
	</svelte:element>
