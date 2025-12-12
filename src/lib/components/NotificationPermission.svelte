<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    requestNotificationPermission, 
    getNotificationPermissionState,
    subscribeToPush,
    unsubscribeFromPush
  } from '$lib/services/pushNotifications';

  type PermissionState = 'granted' | 'denied' | 'default';

  let permissionState: PermissionState | null = null;
  let isSubscribed = false;
  let isLoading = false;
  let showMessage = false;
  let messageType: 'success' | 'error' | 'info' = 'info';
  let messageText = '';
  let isLocalhost = false;

  onMount(async () => {
    try {
      isLocalhost = window.location.hostname === 'localhost' && window.location.protocol !== 'https:';
      const state = await getNotificationPermissionState();
      permissionState = state.permission;
      isSubscribed = state.isSubscribed || false;
    } catch (error) {
      console.error('Failed to check notification permission:', error);
    }
  });

  async function handleEnableNotifications() {
    isLoading = true;
    try {
      console.log('Requesting notification permission...');
      const granted = await requestNotificationPermission();
      console.log('Permission granted:', granted);
      
      if (granted) {
        console.log('Subscribing to push...');
        const subscribed = await subscribeToPush();
        console.log('Subscribed:', subscribed);
        
        if (subscribed) {
          isSubscribed = true;
          permissionState = 'granted';
          messageType = 'success';
          messageText = 'Notificări push activate cu succes!';
        } else {
          messageType = 'error';
          messageText = 'Eroare la abonare la notificări. Vă rugăm încercați din nou.';
        }
      } else {
        permissionState = 'denied';
        messageType = 'info';
        messageText = 'Ați respins accesul la notificări.';
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      messageType = 'error';
      messageText = 'Eroare la activarea notificărilor. Vă rugăm încercați din nou.';
    } finally {
      isLoading = false;
      showMessage = true;
      setTimeout(() => {
        showMessage = false;
      }, 4000);
    }
  }

  async function handleDisableNotifications() {
    isLoading = true;
    try {
      const unsubscribed = await unsubscribeFromPush();
      if (unsubscribed) {
        isSubscribed = false;
        messageType = 'success';
        messageText = 'Notificări dezactivate.';
      } else {
        messageType = 'error';
        messageText = 'Eroare la dezabonare. Vă rugăm încercați din nou.';
      }
    } catch (error) {
      console.error('Error disabling notifications:', error);
      messageType = 'error';
      messageText = 'Eroare la dezactivarea notificărilor.';
    } finally {
      isLoading = false;
      showMessage = true;
      setTimeout(() => {
        showMessage = false;
      }, 4000);
    }
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
  <div class="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white m-0">Notificări push</h3>
    {#if isSubscribed}
      <span class="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Activate</span>
    {:else if permissionState === 'denied'}
      <span class="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Refuzate</span>
    {:else}
      <span class="inline-block px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Inactiv</span>
    {/if}
  </div>

  <div class="space-y-4">
    {#if isLocalhost}
      <div class="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
        <p class="m-0 text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Notificare:</strong> Push notifications necesită HTTPS. Aceasta funcție nu este disponibilă pe localhost în development. În production, va funcționa normal.
        </p>
      </div>
    {:else if permissionState === 'granted' && isSubscribed}
      <p class="m-0 text-green-700 dark:text-green-300">Notificările push sunt activate. Veți primi notificări despre medicamentele tale și alte informații importante.</p>
      <button 
        class="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-600"
        on:click={handleDisableNotifications}
        disabled={isLoading}
      >
        {#if isLoading}
          <span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {/if}
        Dezactivați notificările
      </button>
    {:else if permissionState === 'denied'}
      <p class="m-0 text-red-700 dark:text-red-300">Ați refuzat accesul la notificări.</p>
      <p class="text-sm text-gray-600 dark:text-gray-400 m-0">Pentru a activa notificările, vă rugăm să:</p>
      <ol class="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
        <li>Deschideți setările browserului</li>
        <li>Navigați la setările site-ului pentru MediTrack</li>
        <li>Acordați permisiune pentru notificări</li>
        <li>Reîncărcați pagina</li>
      </ol>
    {:else}
      <p class="m-0 text-blue-700 dark:text-blue-300">Activați notificările push pentru a primi mementouri despre medicamentele tale și alte informații importante.</p>
      <button 
        class="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
        on:click={handleEnableNotifications}
        disabled={isLoading}
      >
        {#if isLoading}
          <span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {/if}
        Activați notificările
      </button>
    {/if}
  </div>

  {#if showMessage}
    <div class="p-3 text-sm rounded-lg mt-4 {messageType === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : messageType === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}">
      {messageText}
    </div>
  {/if}
</div>
