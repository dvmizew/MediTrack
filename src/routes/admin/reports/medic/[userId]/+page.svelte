<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { fade } from 'svelte/transition';

  let loading = $state(true);
  let data = $state<any>(null);
  let error = $state<string | null>(null);

  async function fetchReport() {
    try {
      const token = $authStore.token;
      const userId = $page.params.userId;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/admin/reports/medic/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load medic report');
      data = await res.json();
    } catch (e: any) {
      error = e.message || 'Failed to load medic report';
    } finally {
      loading = false;
    }
  }

  onMount(fetchReport);
</script>

{#if loading}
  <div class="p-6 text-gray-900 dark:text-gray-100">Loading medic report…</div>
{:else if error}
  <div class="p-6 text-red-600 dark:text-red-400">{error}</div>
{:else}
  <div class="p-6 space-y-8 text-gray-900 dark:text-gray-100" in:fade={{ duration: 200 }}>
    <header class="space-y-1">
      <h1 class="text-3xl font-bold tracking-tight">{data.medic.full_name}</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400">{data.medic.email}</p>
    </header>

    <!-- Summary Cards -->
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4">
        <div class="text-xs uppercase text-gray-500">Patients</div>
        <div class="mt-1 text-2xl font-semibold">{data.patients}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Active collaborations</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 250 }}>
        <div class="text-xs uppercase text-gray-500">Treatment Plans</div>
        <div class="mt-1 text-2xl font-semibold">{data.plans}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Assigned to patients</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 300 }}>
        <div class="text-xs uppercase text-gray-500">Messages Sent</div>
        <div class="mt-1 text-2xl font-semibold">{data.messages}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">All time</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 350 }}>
        <div class="text-xs uppercase text-gray-500">Acceptance Rate</div>
        <div class="mt-1 text-2xl font-semibold">{data.invites.acceptanceRate}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Invites</div>
      </div>
    </section>

    <!-- Invites breakdown -->
    <section class="rounded-xl border bg-white dark:bg-gray-800" in:fade={{ duration: 300 }}>
      <div class="p-4 border-b dark:border-gray-700"><h2 class="text-lg font-semibold">Invites</h2></div>
      <div class="p-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 transition-shadow hover:shadow-md">
          <div class="text-xs uppercase text-gray-500">Accepted</div>
          <div class="text-xl font-semibold">{data.invites.accepted}</div>
        </div>
        <div class="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 transition-shadow hover:shadow-md">
          <div class="text-xs uppercase text-gray-500">Rejected</div>
          <div class="text-xl font-semibold">{data.invites.rejected}</div>
        </div>
        <div class="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 transition-shadow hover:shadow-md">
          <div class="text-xs uppercase text-gray-500">Pending</div>
          <div class="text-xl font-semibold">{data.invites.pending}</div>
        </div>
      </div>
    </section>
  </div>
{/if}
