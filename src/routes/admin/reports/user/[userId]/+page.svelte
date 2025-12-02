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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/admin/reports/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load user report');
      data = await res.json();
    } catch (e: any) {
      error = e.message || 'Failed to load user report';
    } finally {
      loading = false;
    }
  }

  onMount(fetchReport);
</script>

{#if loading}
  <div class="p-6 text-gray-900 dark:text-gray-100">Loading user report…</div>
{:else if error}
  <div class="p-6 text-red-600 dark:text-red-400">{error}</div>
{:else}
  <div class="p-6 space-y-8 text-gray-900 dark:text-gray-100" in:fade={{ duration: 200 }}>
    <header class="space-y-1">
      <h1 class="text-3xl font-bold tracking-tight">{data.user.full_name}</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400">{data.user.email}</p>
    </header>

    <!-- Summary Cards -->
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4">
        <div class="text-xs uppercase text-gray-500">Role</div>
        <div class="mt-1 text-xl font-semibold capitalize">{data.user.role}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Active: {data.user.is_active ? 'Yes' : 'No'}</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 250 }}>
        <div class="text-xs uppercase text-gray-500">XP</div>
        <div class="mt-1 text-2xl font-semibold">{data.stats?.nivel_xp ?? 0}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Badge: {data.stats?.current_badge ?? '-'}</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 300 }}>
        <div class="text-xs uppercase text-gray-500">Current Streak</div>
        <div class="mt-1 text-2xl font-semibold">{data.stats?.current_streak ?? 0}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Longest: {data.stats?.longest_streak ?? 0}</div>
      </div>
      <div class="rounded-xl border bg-white dark:bg-gray-800 p-4 transition-transform hover:scale-[1.02]" in:fade={{ duration: 350 }}>
        <div class="text-xs uppercase text-gray-500">Treatments</div>
        <div class="mt-1 text-2xl font-semibold">{data.treatments?.length ?? 0}</div>
        <div class="mt-2 text-xs text-gray-600 dark:text-gray-300">Since {new Date(data.user.created_at).toLocaleDateString()}</div>
      </div>
    </section>

    <!-- Treatments Table -->
    <section class="rounded-xl border bg-white dark:bg-gray-800" in:fade={{ duration: 300 }}>
      <div class="p-4 border-b dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold">Treatments</h2>
      </div>
      <div class="p-4 overflow-x-auto">
        {#if data.treatments.length === 0}
          <div class="text-sm text-gray-500">No treatments</div>
        {:else}
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-600 dark:text-gray-300">
                <th class="py-2 pr-4">Diagnosis</th>
                <th class="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {#each data.treatments as t}
                <tr class="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <td class="py-2 pr-4">{t.diagnoza}</td>
                  <td class="py-2 pr-4">{t.activ ? 'Active' : 'Inactive'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </section>

    <!-- Confirmations -->
    <section class="rounded-xl border bg-white dark:bg-gray-800" in:fade={{ duration: 250 }}>
      <div class="p-4 border-b dark:border-gray-700"><h2 class="text-lg font-semibold">Recent Confirmations</h2></div>
      <div class="p-4">
        {#if data.confirmations.length === 0}
          <div class="text-sm text-gray-500">No confirmations</div>
        {:else}
          <ul class="space-y-2 text-sm">
            {#each data.confirmations as c}
              <li class="flex justify-between hover:translate-x-0.5 transition-transform">
                <span>{new Date(c.scheduled_for).toLocaleString()}</span>
                <span class="capitalize font-semibold">{c.rezultat}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>
  </div>
{/if}
