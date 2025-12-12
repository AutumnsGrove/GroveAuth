<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { theme } from '$lib/theme';
  import { AUTH_API_URL } from '$lib/config';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  const { serverStatus, whitelist, history, user, accessToken } = data;

  // State management
  let selectedRegion = $state<'eu' | 'us'>('eu');
  let isLoading = $state(false);
  let actionError = $state<string | null>(null);
  let actionSuccess = $state<string | null>(null);
  let whitelistInput = $state('');
  let commandInput = $state('');
  let commandOutput = $state<string | null>(null);

  // Auto-refresh every 30 seconds when server is not offline
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (serverStatus?.state && serverStatus.state !== 'OFFLINE') {
      refreshInterval = setInterval(() => {
        invalidateAll();
      }, 30000);
    }
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });

  // Format date for display
  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Format duration
  function formatDuration(seconds: number | null | undefined): string {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Format cost
  function formatCost(usd: number | null | undefined): string {
    if (usd === null || usd === undefined) return '$0.00';
    return `$${usd.toFixed(2)}`;
  }

  // Format bytes
  function formatBytes(bytes: number | null | undefined): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  // State color mapping
  function getStateColor(state: string): string {
    switch (state) {
      case 'RUNNING': return 'bg-grove-500';
      case 'IDLE': return 'bg-yellow-500';
      case 'PROVISIONING': return 'bg-blue-500 animate-pulse';
      case 'SUSPENDED': return 'bg-orange-500';
      case 'TERMINATING': return 'bg-red-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  }

  // State label
  function getStateLabel(state: string): string {
    switch (state) {
      case 'RUNNING': return 'Online';
      case 'IDLE': return 'Idle';
      case 'PROVISIONING': return 'Starting...';
      case 'SUSPENDED': return 'Suspended';
      case 'TERMINATING': return 'Stopping...';
      default: return 'Offline';
    }
  }

  // Detailed state description
  function getStateDescription(state: string): string {
    switch (state) {
      case 'RUNNING': return 'Server is online and ready';
      case 'IDLE': return 'No players, will suspend soon';
      case 'PROVISIONING': return 'VPS starting, downloading mods & world...';
      case 'SUSPENDED': return 'Paused to save costs';
      case 'TERMINATING': return 'Saving world and shutting down...';
      default: return 'Server is offline';
    }
  }

  // Calculate TTL countdown
  function calculateTTL(): string {
    if (!serverStatus || serverStatus.state === 'OFFLINE') return '--';
    if (serverStatus.state === 'RUNNING' && (serverStatus.players?.online ?? 0) > 0) return 'Active';

    const idleSeconds = serverStatus.idleTime || 0;
    const idleTimeout = 900; // 15 minutes
    const remaining = Math.max(0, idleTimeout - idleSeconds);

    if (remaining === 0) return 'Soon';
    return formatDuration(remaining);
  }

  // Calculate current session cost
  function calculateSessionCost(): number {
    // Use the cost from API if available
    if (serverStatus?.costs?.currentSession) {
      return serverStatus.costs.currentSession;
    }
    return 0;
  }

  // Get hourly rate from API or default
  function getHourlyRate(): number {
    return serverStatus?.costs?.hourlyRate || (serverStatus?.region === 'eu' ? 0.0119 : 0.0119);
  }

  // API actions
  async function startServer() {
    isLoading = true;
    actionError = null;
    actionSuccess = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ region: selectedRegion }),
      });

      const result = await response.json();

      if (!response.ok) {
        actionError = result.error_description || result.error || 'Failed to start server';
      } else {
        actionSuccess = `Server starting in ${selectedRegion.toUpperCase()} region...`;
        setTimeout(() => invalidateAll(), 2000);
      }
    } catch (e) {
      actionError = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function stopServer() {
    if (!confirm('Are you sure you want to stop the server? This will save and backup the world.')) {
      return;
    }

    isLoading = true;
    actionError = null;
    actionSuccess = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ graceful: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        actionError = result.error_description || result.error || 'Failed to stop server';
      } else {
        actionSuccess = 'Server stopping...';
        setTimeout(() => invalidateAll(), 2000);
      }
    } catch (e) {
      actionError = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function triggerBackup() {
    isLoading = true;
    actionError = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        actionError = result.error_description || 'Failed to trigger backup';
      } else {
        actionSuccess = 'Backup triggered!';
        setTimeout(() => {
          actionSuccess = null;
          invalidateAll();
        }, 3000);
      }
    } catch (e) {
      actionError = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function addToWhitelist() {
    if (!whitelistInput.trim()) return;

    isLoading = true;
    actionError = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/whitelist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: whitelistInput.trim(), action: 'add' }),
      });

      const result = await response.json();

      if (!response.ok) {
        actionError = result.error_description || 'Failed to add player';
      } else {
        actionSuccess = `Added ${whitelistInput} to whitelist`;
        whitelistInput = '';
        setTimeout(() => {
          actionSuccess = null;
          invalidateAll();
        }, 2000);
      }
    } catch (e) {
      actionError = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function removeFromWhitelist(username: string) {
    if (!confirm(`Remove ${username} from whitelist?`)) return;

    isLoading = true;
    actionError = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/whitelist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, action: 'remove' }),
      });

      const result = await response.json();

      if (!response.ok) {
        actionError = result.error_description || 'Failed to remove player';
      } else {
        invalidateAll();
      }
    } catch (e) {
      actionError = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function sendCommand() {
    if (!commandInput.trim()) return;

    isLoading = true;
    actionError = null;
    commandOutput = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/command`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: commandInput.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        actionError = result.error_description || 'Command failed';
      } else {
        commandOutput = result.message || 'Command sent';
        commandInput = '';
      }
    } catch (e) {
      actionError = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  // Theme toggle
  function toggleTheme() {
    theme.toggle();
  }

  let isDark = $derived($theme);

  // Derived values
  let isServerOnline = $derived(serverStatus?.state && serverStatus.state !== 'OFFLINE');
  let canStartServer = $derived(!isServerOnline && !isLoading);
  let canStopServer = $derived(isServerOnline && !isLoading && serverStatus?.state !== 'TERMINATING');
</script>

<svelte:head>
  <title>Minecraft Admin - GroveAuth</title>
</svelte:head>

<main class="min-h-screen p-6 md:p-8">
  <!-- Header -->
  <header class="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
    <div class="flex items-center gap-4">
      <a href="/dashboard" class="hover:opacity-80 transition-opacity">
        <Logo size="sm" />
      </a>
      <div>
        <h1 class="text-2xl font-serif text-bark dark:text-gray-100">Minecraft Server</h1>
        <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">On-Demand Management</p>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <!-- Region Toggle -->
      {#if !isServerOnline}
        <div class="flex items-center gap-2 bg-grove-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onclick={() => selectedRegion = 'eu'}
            class="px-3 py-1.5 rounded-md text-sm font-sans transition-colors {selectedRegion === 'eu' ? 'bg-white dark:bg-gray-600 text-bark dark:text-gray-100 shadow-sm' : 'text-bark/60 dark:text-gray-400 hover:text-bark dark:hover:text-gray-200'}"
          >
            EU
          </button>
          <button
            onclick={() => selectedRegion = 'us'}
            class="px-3 py-1.5 rounded-md text-sm font-sans transition-colors {selectedRegion === 'us' ? 'bg-white dark:bg-gray-600 text-bark dark:text-gray-100 shadow-sm' : 'text-bark/60 dark:text-gray-400 hover:text-bark dark:hover:text-gray-200'}"
          >
            US
          </button>
        </div>
      {/if}

      <!-- Start/Stop Button -->
      {#if canStartServer}
        <button
          onclick={startServer}
          disabled={isLoading}
          class="btn-primary flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Start Server
        </button>
      {:else if canStopServer}
        <button
          onclick={stopServer}
          disabled={isLoading}
          class="bg-red-600 hover:bg-red-700 text-white font-sans font-medium px-6 py-3 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
          Stop Server
        </button>
      {:else}
        <button disabled class="btn-secondary opacity-50 cursor-not-allowed">
          {serverStatus?.state === 'PROVISIONING' ? 'Starting...' : serverStatus?.state === 'TERMINATING' ? 'Stopping...' : 'Loading...'}
        </button>
      {/if}

      <!-- Theme Toggle -->
      <button
        onclick={toggleTheme}
        class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700 hover:bg-grove-200 dark:hover:bg-gray-600 transition-colors"
        aria-label="Toggle theme"
      >
        {#if isDark}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        {/if}
      </button>
    </div>
  </header>

  <!-- Error/Success Messages -->
  {#if actionError}
    <div class="alert-error mb-6 flex items-center justify-between">
      <span>{actionError}</span>
      <button onclick={() => actionError = null} class="text-red-700 hover:text-red-900">&times;</button>
    </div>
  {/if}
  {#if actionSuccess}
    <div class="alert-success mb-6 flex items-center justify-between">
      <span>{actionSuccess}</span>
      <button onclick={() => actionSuccess = null} class="text-grove-700 hover:text-grove-900">&times;</button>
    </div>
  {/if}

  <!-- Status Grid (Top Row) -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
    <!-- Server Status Card -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400">Server Status</h3>
        <div class="w-3 h-3 rounded-full {getStateColor(serverStatus?.state || 'OFFLINE')}"></div>
      </div>
      <p class="text-2xl font-serif text-bark dark:text-gray-100 mb-1">{getStateLabel(serverStatus?.state || 'OFFLINE')}</p>
      <p class="text-xs text-bark/50 dark:text-gray-500 font-sans">{getStateDescription(serverStatus?.state || 'OFFLINE')}</p>
      {#if serverStatus?.region}
        <p class="text-xs text-bark/50 dark:text-gray-500 font-sans mt-1">Region: {serverStatus.region.toUpperCase()}</p>
      {/if}
      {#if serverStatus?.serverIp && isServerOnline}
        <p class="text-xs text-bark/50 dark:text-gray-500 font-mono mt-1">mc.grove.place</p>
      {/if}
    </div>

    <!-- Players Online Card -->
    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-3">Players Online</h3>
      <p class="text-3xl font-serif text-bark dark:text-gray-100">
        {serverStatus?.players?.online ?? 0}
        <span class="text-lg text-bark/40 dark:text-gray-500">/ {serverStatus?.players?.max ?? 20}</span>
      </p>
      {#if serverStatus?.players?.list && serverStatus.players.list.length > 0}
        <div class="mt-2 text-xs text-bark/60 dark:text-gray-400 font-sans">
          {serverStatus.players.list.slice(0, 3).join(', ')}
          {#if serverStatus.players.list.length > 3}
            <span class="text-bark/40 dark:text-gray-500">+{serverStatus.players.list.length - 3} more</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- TTL Countdown Card -->
    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-3">Auto-Shutdown</h3>
      <p class="text-3xl font-serif text-bark dark:text-gray-100">{calculateTTL()}</p>
      <p class="text-xs text-bark/50 dark:text-gray-500 font-sans mt-1">
        {#if !isServerOnline}
          Server offline
        {:else if (serverStatus?.players?.online ?? 0) > 0}
          Players active
        {:else}
          Until idle timeout
        {/if}
      </p>
    </div>

    <!-- Session Cost Card -->
    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-3">Session Cost</h3>
      <p class="text-3xl font-serif text-bark dark:text-gray-100">{formatCost(calculateSessionCost())}</p>
      <p class="text-xs text-bark/50 dark:text-gray-500 font-sans mt-1">
        {#if serverStatus?.region}
          ${getHourlyRate().toFixed(4)}/hr ({serverStatus.region.toUpperCase()})
        {:else}
          --
        {/if}
      </p>
    </div>
  </div>

  <!-- Second Row: Storage, Backup, Uptime -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
    <!-- Storage Card -->
    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-3">World Size</h3>
      <p class="text-2xl font-serif text-bark dark:text-gray-100">
        {formatBytes(serverStatus?.worldSizeBytes)}
      </p>
      <p class="text-xs text-bark/50 dark:text-gray-500 font-sans mt-1">R2 storage</p>
    </div>

    <!-- Last Backup Card -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400">Last Backup</h3>
        {#if isServerOnline}
          <button
            onclick={triggerBackup}
            disabled={isLoading}
            class="text-xs text-grove-600 dark:text-grove-400 hover:text-grove-700 dark:hover:text-grove-300 font-sans disabled:opacity-50"
          >
            Backup Now
          </button>
        {/if}
      </div>
      <p class="text-lg font-serif text-bark dark:text-gray-100">
        {formatDate(serverStatus?.lastWorldSync)}
      </p>
    </div>

    <!-- Uptime Card -->
    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-3">Uptime</h3>
      <p class="text-2xl font-serif text-bark dark:text-gray-100">
        {#if serverStatus?.uptime && isServerOnline}
          {formatDuration(serverStatus.uptime)}
        {:else}
          --
        {/if}
      </p>
      {#if serverStatus?.uptime && isServerOnline}
        <p class="text-xs text-bark/50 dark:text-gray-500 font-sans mt-1">Server running</p>
      {/if}
    </div>
  </div>

  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <!-- Whitelist Management -->
    <div class="card p-6">
      <h3 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Whitelist</h3>

      <!-- Add Player Form -->
      <div class="flex gap-2 mb-4">
        <input
          type="text"
          bind:value={whitelistInput}
          placeholder="Minecraft username"
          class="input-field flex-1"
          onkeydown={(e) => e.key === 'Enter' && addToWhitelist()}
        />
        <button
          onclick={addToWhitelist}
          disabled={isLoading || !whitelistInput.trim()}
          class="btn-primary px-4 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <!-- Whitelist Table -->
      {#if whitelist && whitelist.length > 0}
        <div class="space-y-2 max-h-64 overflow-y-auto">
          {#each whitelist as player}
            <div class="flex items-center justify-between p-2 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg">
              <div>
                <p class="font-sans text-bark dark:text-gray-100">{player.name}</p>
                {#if player.uuid}
                  <p class="text-xs text-bark/50 dark:text-gray-400 font-mono">{player.uuid.slice(0, 8)}...</p>
                {/if}
              </div>
              <button
                onclick={() => removeFromWhitelist(player.name)}
                class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                title="Remove from whitelist"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-bark/40 dark:text-gray-500 text-sm font-sans italic">No players whitelisted</p>
      {/if}
    </div>

    <!-- Console Commands -->
    <div class="card p-6">
      <h3 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Console</h3>

      {#if isServerOnline && serverStatus?.state === 'RUNNING'}
        <div class="flex gap-2 mb-4">
          <input
            type="text"
            bind:value={commandInput}
            placeholder="Enter command (e.g., list, say Hello)"
            class="input-field flex-1 font-mono text-sm"
            onkeydown={(e) => e.key === 'Enter' && sendCommand()}
          />
          <button
            onclick={sendCommand}
            disabled={isLoading || !commandInput.trim()}
            class="btn-primary px-4 disabled:opacity-50"
          >
            Send
          </button>
        </div>

        {#if commandOutput}
          <div class="p-3 bg-gray-900 rounded-lg text-green-400 font-mono text-sm">
            {commandOutput}
          </div>
        {/if}

        <p class="text-xs text-bark/50 dark:text-gray-500 font-sans mt-2">
          Some commands are blocked for safety (stop, op, ban, etc.)
        </p>
      {:else}
        <p class="text-bark/40 dark:text-gray-500 text-sm font-sans italic">
          Console available when server is running
        </p>
      {/if}
    </div>
  </div>

  <!-- Session History -->
  <div class="card p-6 mb-6">
    <h3 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Session History</h3>

    {#if history?.thisMonth}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="p-3 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg">
          <p class="text-xs text-bark/60 dark:text-gray-400 font-sans">This Month</p>
          <p class="text-lg font-serif text-bark dark:text-gray-100">{formatCost(history.thisMonth.totalCost)}</p>
        </div>
        <div class="p-3 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg">
          <p class="text-xs text-bark/60 dark:text-gray-400 font-sans">Hours</p>
          <p class="text-lg font-serif text-bark dark:text-gray-100">{(history.thisMonth.totalHours || 0).toFixed(1)}h</p>
        </div>
        <div class="p-3 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg">
          <p class="text-xs text-bark/60 dark:text-gray-400 font-sans">Sessions</p>
          <p class="text-lg font-serif text-bark dark:text-gray-100">{history.thisMonth.sessionCount || 0}</p>
        </div>
        <div class="p-3 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg">
          <p class="text-xs text-bark/60 dark:text-gray-400 font-sans">Total (All Time)</p>
          <p class="text-lg font-serif text-bark dark:text-gray-100">{formatCost(history.totals?.allTime?.cost || 0)}</p>
        </div>
      </div>
    {/if}

    {#if history?.sessions && history.sessions.length > 0}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-grove-200 dark:border-gray-600">
              <th class="text-left py-2 text-bark/60 dark:text-gray-400 font-sans font-normal">Date</th>
              <th class="text-left py-2 text-bark/60 dark:text-gray-400 font-sans font-normal">Duration</th>
              <th class="text-left py-2 text-bark/60 dark:text-gray-400 font-sans font-normal">Region</th>
              <th class="text-left py-2 text-bark/60 dark:text-gray-400 font-sans font-normal">Max Players</th>
              <th class="text-right py-2 text-bark/60 dark:text-gray-400 font-sans font-normal">Cost</th>
            </tr>
          </thead>
          <tbody>
            {#each history.sessions as session}
              <tr class="border-b border-grove-100 dark:border-gray-700">
                <td class="py-2 text-bark dark:text-gray-200 font-sans">{formatDate(session.startedAt)}</td>
                <td class="py-2 text-bark/70 dark:text-gray-300 font-sans">{session.durationFormatted || formatDuration(session.durationSeconds)}</td>
                <td class="py-2 text-bark/70 dark:text-gray-300 font-sans">{session.region?.toUpperCase() || '-'}</td>
                <td class="py-2 text-bark/70 dark:text-gray-300 font-sans">{session.maxPlayers || 0}</td>
                <td class="py-2 text-bark dark:text-gray-200 font-sans text-right">{formatCost(session.costUsd)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="text-bark/40 dark:text-gray-500 text-sm font-sans italic">No session history yet</p>
    {/if}
  </div>

  <!-- Dynmap Embed -->
  {#if isServerOnline && serverStatus?.state === 'RUNNING'}
    <div class="card p-6 mb-6">
      <h3 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Live Map (Dynmap)</h3>
      <div class="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <iframe
          src="https://map.grove.place"
          title="Dynmap"
          class="w-full h-full border-0"
          loading="lazy"
        ></iframe>
      </div>
    </div>
  {/if}

  <!-- Footer -->
  <footer class="mt-12 text-center">
    <div class="flex items-center justify-center gap-4 text-sm font-sans text-bark/50 dark:text-gray-500">
      <a href="/dashboard" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">Auth Dashboard</a>
      <span class="text-grove-300 dark:text-gray-600">·</span>
      <a href="https://mc.grove.place" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">Public Status</a>
      <span class="text-grove-300 dark:text-gray-600">·</span>
      <a href="https://grove.place" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">Grove</a>
    </div>
  </footer>
</main>
