<script lang="ts">
	export let streak: number = 0;
	export let countdownText: string = '--:--:--';
	export let progress: number = 0;
	export let status: 'none' | 'normal' | 'warning' | 'critical' | 'done' = 'none';
	export let muted: boolean = false;

	const radius = 48;
	const circumference = 2 * Math.PI * radius;

	$: safeProgress = Math.max(0, Math.min(progress, 1));
	$: dashOffset = circumference * (1 - safeProgress);
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
			<circle class={`inner-core ${status} ${muted ? 'muted' : ''}`} cx="60" cy="60" r="40" fill="url(#innerGlow)" />
			<circle cx="60" cy="60" r="40" fill="none" stroke="rgba(148, 163, 184, 0.35)" stroke-width="1" />

			<!-- Streak + countdown -->
			<text x="60" y="58" text-anchor="middle" font-size="30" fill={muted ? '#475569' : '#0f172a'} font-weight="700">
				{streak}
			</text>
			<text x="60" y="82" text-anchor="middle" font-size="16" fill={muted ? '#64748b' : '#334155'} font-weight="700">
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

	.inner-core.normal {
		fill: #ecfeff;
}

	.inner-core.warning {
		fill: #fef3c7;
	}

	.inner-core.critical {
		fill: #fee2e2;
	}

	.inner-core.done {
		fill: #dcfce7;
	}

	.inner-core.muted {
		fill: #e2e8f0;
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
