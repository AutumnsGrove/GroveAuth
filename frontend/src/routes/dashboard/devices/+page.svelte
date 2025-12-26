<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { theme } from '$lib/theme';
  import { Sun, Moon, Smartphone, Laptop, Monitor, ArrowLeft, Trash2, LogOut, Check } from 'lucide-svelte';
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  const { sessions, user, error } = data;

  // Format timestamp to readable date
  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Format relative time
  function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(timestamp);
  }

  // Get device icon based on device name
  function getDeviceIcon(deviceName: string) {
    const name = deviceName.toLowerCase();
    if (name.includes('iphone') || name.includes('android') || name.includes('mobile')) {
      return Smartphone;
    }
    if (name.includes('mac') || name.includes('windows') || name.includes('linux')) {
      return Laptop;
    }
    return Monitor;
  }

  // Theme toggle
  function toggleTheme() {
    theme.toggle();
  }

  let isDark = $derived($theme);

  // Track which session is being revoked
  let revokingSession = $state<string | null>(null);
  let revokingAll = $state(false);
</script>

<svelte:head>
  <title>Manage Devices - Heartwood</title>
</svelte:head>

<main class="min-h-screen p-6 md:p-8">
  <!-- Header -->
  <header class="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
    <div class="flex items-center gap-4">
      <a href="/dashboard" class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700 hover:bg-grove-200 dark:hover:bg-gray-600 transition-colors">
        <ArrowLeft size={20} class="text-bark dark:text-gray-300" />
      </a>
      <Logo size="sm" />
      <div>
        <h1 class="text-2xl font-serif text-bark dark:text-gray-100">Manage Devices</h1>
        <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">View and manage your active sessions</p>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm text-bark/60 dark:text-gray-400 font-sans">
        Logged in as <span class="text-bark dark:text-gray-200">{user?.email}</span>
      </span>
      <button
        onclick={toggleTheme}
        class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700 hover:bg-grove-200 dark:hover:bg-gray-600 transition-colors"
        aria-label="Toggle theme"
      >
        {#if isDark}
          <Sun size={20} class="text-yellow-400" />
        {:else}
          <Moon size={20} class="text-gray-700" />
        {/if}
      </button>
    </div>
  </header>

  <!-- Status Messages -->
  {#if form?.success}
    <div class="mb-6 p-4 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
      <p class="text-green-800 dark:text-green-300 font-sans flex items-center gap-2">
        <Check size={18} />
        {form.message}
      </p>
    </div>
  {/if}

  {#if form?.error || error}
    <div class="mb-6 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
      <p class="text-red-800 dark:text-red-300 font-sans">{form?.error || error}</p>
    </div>
  {/if}

  <!-- Revoke All Button -->
  {#if sessions.length > 1}
    <div class="mb-6">
      <form
        method="POST"
        action="?/revokeAll"
        use:enhance={() => {
          revokingAll = true;
          return async ({ update }) => {
            await update();
            revokingAll = false;
          };
        }}
      >
        <button
          type="submit"
          disabled={revokingAll}
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans"
        >
          <LogOut size={18} />
          {revokingAll ? 'Signing out...' : 'Sign out of all other devices'}
        </button>
      </form>
    </div>
  {/if}

  <!-- Sessions List -->
  <div class="space-y-4">
    {#if sessions.length === 0}
      <div class="card p-8 text-center">
        <p class="text-bark/60 dark:text-gray-400 font-sans">No active sessions found</p>
      </div>
    {:else}
      {#each sessions as session (session.id)}
        {@const DeviceIcon = getDeviceIcon(session.deviceName)}
        <div class="card p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4 {session.isCurrent ? 'ring-2 ring-grove-500 dark:ring-grove-400' : ''}">
          <!-- Device Icon & Info -->
          <div class="flex items-start gap-4 flex-1">
            <div class="p-3 rounded-lg bg-grove-100 dark:bg-gray-700">
              <DeviceIcon size={24} class="text-grove-600 dark:text-grove-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-serif text-bark dark:text-gray-100">{session.deviceName}</h3>
                {#if session.isCurrent}
                  <span class="px-2 py-0.5 text-xs font-sans rounded-full bg-grove-500 text-white">
                    This device
                  </span>
                {/if}
              </div>
              <div class="mt-1 space-y-0.5">
                <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">
                  Last active: {formatRelativeTime(session.lastActiveAt)}
                </p>
                <p class="text-sm text-bark/40 dark:text-gray-500 font-sans">
                  Created: {formatDate(session.createdAt)}
                </p>
                {#if session.ipAddress}
                  <p class="text-sm text-bark/40 dark:text-gray-500 font-sans">
                    IP: {session.ipAddress}
                  </p>
                {/if}
              </div>
            </div>
          </div>

          <!-- Revoke Button -->
          {#if !session.isCurrent}
            <form
              method="POST"
              action="?/revoke"
              use:enhance={() => {
                revokingSession = session.id;
                return async ({ update }) => {
                  await update();
                  revokingSession = null;
                };
              }}
            >
              <input type="hidden" name="sessionId" value={session.id} />
              <button
                type="submit"
                disabled={revokingSession === session.id}
                class="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm"
              >
                <Trash2 size={16} />
                {revokingSession === session.id ? 'Revoking...' : 'Revoke'}
              </button>
            </form>
          {:else}
            <span class="text-sm text-bark/40 dark:text-gray-500 font-sans italic">
              Current session
            </span>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Session Info -->
  <div class="mt-8 p-4 rounded-lg bg-grove-50 dark:bg-gray-800/50 border border-grove-200 dark:border-gray-700">
    <h3 class="font-serif text-bark dark:text-gray-100 mb-2">About Sessions</h3>
    <ul class="text-sm text-bark/60 dark:text-gray-400 font-sans space-y-1">
      <li>• Sessions automatically expire after 30 days of inactivity</li>
      <li>• Revoking a session will sign you out of that device immediately</li>
      <li>• "Sign out of all other devices" keeps your current session active</li>
    </ul>
  </div>
</main>
