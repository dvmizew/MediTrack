<script lang="ts">
	let {
		streak = 0,
		countdownText = '--:--:--',
		progress = 0,
		status = 'none' as 'none' | 'normal' | 'warning' | 'critical' | 'done',
		muted = false
	} = $props<{
		streak?: number;
		countdownText?: string;
		progress?: number;
		status?: 'none' | 'normal' | 'warning' | 'critical' | 'done';
		muted?: boolean;
	}>();

	const radius = 48;
	const circumference = 2 * Math.PI * radius;

	const safeProgress = $derived(Math.max(0, Math.min(progress, 1)));
	const dashOffset = $derived(circumference * (1 - safeProgress));
	
	let isDark = $state(false);
	
	$effect(() => {
		isDark = document.documentElement.classList.contains('dark');
		
		const observer = new MutationObserver(() => {
			isDark = document.documentElement.classList.contains('dark');
		});
		
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});
		
		return () => observer.disconnect();
	});
</script>

<div class="flex items-center justify-center">
	<div class={`relative w-64 h-64 ring-breathe ${status} ${status === 'critical' ? 'ring-alert' : ''} ${muted ? 'muted' : ''}`}>
		<svg class="absolute inset-0 w-full h-full" viewBox="0 0 120 120" role="img" aria-label={`Streak curent: ${streak} zile`}> 
			<defs>
				<radialGradient id="innerGlow" cx="35%" cy="30%" r="70%">
					<stop offset="0%" stop-color="#f0f9ff" />
					<stop offset="60%" stop-color="#e0f2fe" />
					<stop offset="100%" stop-color="#ecfeff" />
				</radialGradient>
				<radialGradient id="innerGlowDark" cx="35%" cy="30%" r="70%">
					<stop offset="0%" stop-color="#0e7490" />
					<stop offset="60%" stop-color="#0891b2" />
					<stop offset="100%" stop-color="#06b6d4" />
				</radialGradient>
			</defs>

			<!-- Outer subtle ring -->
			<circle cx="60" cy="60" r="52" stroke="rgba(148, 163, 184, 0.25)" stroke-width="10" fill="none" />

			<!-- Progress ring (time until next dose) -->
			<circle
				class={`progress-ring ${status} ${muted ? 'muted' : ''}`}
				cx="60"
				cy="60"
				r={radius}
				stroke-width="10"
				stroke-linecap="round"
				fill="none"
				stroke-dasharray={circumference}
				stroke-dashoffset={dashOffset}
				transform="rotate(-90 60 60)"
			/>

			<!-- Inner badge -->
			<circle 
				class={`inner-core ${status} ${muted ? 'muted' : ''}`} 
				cx="60" 
				cy="60" 
				r="40" 
				fill={isDark ? 'url(#innerGlowDark)' : 'url(#innerGlow)'} 
			/>
			<circle cx="60" cy="60" r="40" fill="none" stroke="rgba(148, 163, 184, 0.35)" stroke-width="1" />

			<!-- Streak + countdown -->
			<text
				x="60"
				y="58"
				text-anchor="middle"
				font-size="30"
				font-weight="700"
				class={muted ? 'fill-slate-600 dark:fill-slate-300' : 'fill-slate-900 dark:fill-slate-100'}
			>
				{streak}
			</text>
			<text
				x="60"
				y="82"
				text-anchor="middle"
				font-size="16"
				font-weight="700"
				class={muted ? 'fill-slate-500 dark:fill-slate-400' : 'fill-slate-700 dark:fill-slate-200'}
			>
				{countdownText}
			</text>
		</svg>
	</div>
</div>

<style>
	div {
		--webkit-font-smoothing: antialiased;
	}

	svg {
		filter: drop-shadow(0 12px 25px rgba(15, 23, 42, 0.12));
	}

	.progress-ring {
		transition: stroke-dashoffset 0.35s linear;
	}

	.progress-ring.normal {
		stroke: #22c55e;
	}

	.progress-ring.warning {
		stroke: #f59e0b;
	}

	.progress-ring.critical {
		stroke: #ef4444;
	}

	.progress-ring.done {
		stroke: #22c55e;
	}

	.progress-ring.muted {
		stroke: #94a3b8;
	}

	.ring-breathe.normal {
		animation: breathe 6s ease-in-out infinite;
	}

	.ring-breathe.warning {
		animation: breathe 3s ease-in-out infinite;
	}

	.ring-breathe.critical {
		animation: breathe 1.4s ease-in-out infinite;
	}

	.ring-breathe.done {
		animation: breathe 5s ease-in-out infinite;
	}

	.ring-breathe.muted {
		filter: grayscale(1) saturate(0.2);
	}

	@keyframes breathe {
		0%, 100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.04);
		}
	}

	.ring-alert {
		animation: alert-pulse 1s ease-in-out infinite;
	}

	@keyframes alert-pulse {
		0%, 100% {
			transform: scale(1) translate3d(0, 0, 0);
		}
		50% {
			transform: scale(1.08) translate3d(3px, -4px, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ring-alert {
			animation: none;
		}
	}
</style>
