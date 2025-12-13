<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth';
  import { fade } from 'svelte/transition';
  import Chart from 'chart.js/auto';

  let loading = $state(true);
  let overview = $state<any>(null);
  let error = $state<string | null>(null);

  let adherence7Canvas = $state<HTMLCanvasElement | null>(null);
  let adherence30Canvas = $state<HTMLCanvasElement | null>(null);

  function renderCharts() {
    if (!overview || !adherence7Canvas || !adherence30Canvas) return;
    const seven = overview.adherence.last7Days;
    const thirty = overview.adherence.last30Days;

    // Destroy existing charts if any
    const existing7 = Chart.getChart(adherence7Canvas);
    existing7?.destroy();
    const existing30 = Chart.getChart(adherence30Canvas);
    existing30?.destroy();

    new Chart(adherence7Canvas, {
      type: 'doughnut',
      data: {
        labels: ['Confirmed', 'Remaining'],
        datasets: [{
          data: [seven.confirmed, Math.max(seven.scheduled - seven.confirmed, 0)],
          backgroundColor: ['#22c55e', '#f87171'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 8, font: { size: 10 } }
          }
        },
        cutout: '70%'
      }
    });

    new Chart(adherence30Canvas, {
      type: 'bar',
      data: {
        labels: ['Scheduled', 'Confirmed'],
        datasets: [{
          data: [thirty.scheduled, thirty.confirmed],
          backgroundColor: ['#60a5fa', '#34d399'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  async function fetchOverview() {
    try {
      const token = $authStore.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/admin/reports/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load overview');
      overview = await res.json();
      // render after next tick
      setTimeout(renderCharts, 0);
    } catch (e: any) {
      error = e.message || 'Failed to load overview';
    } finally {
      loading = false;
    }
  }

  onMount(fetchOverview);
</script>

{#if loading}
  <div class="p-6 text-gray-900 dark:text-gray-100">Loading reports…</div>
{:else if error}
  <div class="p-6 text-red-600 dark:text-red-400">{error}</div>
{:else}
  <div class="p-6 space-y-8 text-gray-900 dark:text-gray-100" in:fade={{ duration: 200 }}>
    <header class="flex items-end justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p class="text-sm text-gray-600 dark:text-gray-300">System overview, activity, and adherence</p>
      </div>
    </header>

    <!-- KPI Cards -->
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 250 }}>
        <div class="text-xs uppercase text-gray-500">Total Users</div>
        <div class="mt-1 text-2xl font-semibold">{overview.users.active + overview.users.inactive}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Active {overview.users.active} · Inactive {overview.users.inactive}</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 300 }}>
        <div class="text-xs uppercase text-gray-500">Collaborations</div>
        <div class="mt-1 text-2xl font-semibold">{overview.collaborations.reduce((a,c)=>a+c.count,0)}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Accepted {overview.collaborations.find(c=>c.status==='accepted')?.count || 0}</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 350 }}>
        <div class="text-xs uppercase text-gray-500">Active Treatments</div>
        <div class="mt-1 text-2xl font-semibold">{overview.treatments.active}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Total {overview.treatments.total}</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 400 }}>
        <div class="text-xs uppercase text-gray-500">Total Doses</div>
        <div class="mt-1 text-2xl font-semibold">{overview.doses.total}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Last 7d conf. {overview.adherence.last7Days.confirmed}</div>
      </div>
    </section>

    <!-- Users by Role -->
    <section class="rounded-xl border bg-white dark:bg-gray-800" in:fade={{ duration: 300 }}>
      <div class="p-4 border-b dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold">Users by Role</h2>
      </div>
      <div class="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each overview.users.byRole as r}
          <div class="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 flex items-center justify-between transition-transform hover:translate-y-0.5">
            <div class="font-medium capitalize">{r.role}</div>
            <div class="text-xl font-semibold">{r.count}</div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Collaborations & Treatments -->
    <section class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl border bg-white dark:bg-gray-800" in:fade={{ duration: 250 }}>
        <div class="p-4 border-b dark:border-gray-700"><h2 class="text-lg font-semibold">Collaborations</h2></div>
        <div class="p-4 space-y-2">
          {#each overview.collaborations as c}
            <div class="flex items-center justify-between">
              <span class="capitalize">{c.status}</span>
              <span class="font-semibold">{c.count}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800" in:fade={{ duration: 300 }}>
        <div class="p-4 border-b dark:border-gray-700"><h2 class="text-lg font-semibold">Treatments</h2></div>
        <div class="p-4 space-y-2">
          <div class="flex items-center justify-between"><span>Active</span><span class="font-semibold">{overview.treatments.active}</span></div>
          <div class="flex items-center justify-between"><span>Inactive</span><span class="font-semibold">{overview.treatments.inactive}</span></div>
          <div class="flex items-center justify-between"><span>Total</span><span class="font-semibold">{overview.treatments.total}</span></div>
        </div>
      </div>
    </section>

    <!-- Adherence -->
    <section class="rounded-xl border bg-white dark:bg-gray-800" in:fade={{ duration: 300 }}>
      <div class="p-4 border-b dark:border-gray-700"><h2 class="text-lg font-semibold">Adherence</h2></div>
      <div class="p-4 grid gap-4 md:grid-cols-2">
        <div class="rounded-lg bg-gray-50 dark:bg-gray-900 p-4 transition-shadow hover:shadow-md">
          <div class="font-medium mb-3 text-center">Last 7 days</div>
          <div class="mb-3 max-w-[180px] mx-auto">
            <canvas bind:this={adherence7Canvas}></canvas>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs text-center">
            <div><div class="text-gray-500">Scheduled</div><div class="font-semibold">{overview.adherence.last7Days.scheduled}</div></div>
            <div><div class="text-gray-500">Confirmed</div><div class="font-semibold">{overview.adherence.last7Days.confirmed}</div></div>
            <div><div class="text-gray-500">Rate</div><div class="font-semibold">{overview.adherence.last7Days.rate}</div></div>
          </div>
        </div>
        <div class="rounded-lg bg-gray-50 dark:bg-gray-900 p-4 transition-shadow hover:shadow-md">
          <div class="font-medium mb-3 text-center">Last 30 days</div>
          <div class="mb-3 max-w-[200px] mx-auto">
            <canvas bind:this={adherence30Canvas}></canvas>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs text-center">
            <div><div class="text-gray-500">Scheduled</div><div class="font-semibold">{overview.adherence.last30Days.scheduled}</div></div>
            <div><div class="text-gray-500">Confirmed</div><div class="font-semibold">{overview.adherence.last30Days.confirmed}</div></div>
            <div><div class="text-gray-500">Rate</div><div class="font-semibold">{overview.adherence.last30Days.rate}</div></div>
          </div>
        </div>
      </div>
    </section>
  </div>
{/if}
