<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { theme } from '$lib/theme';
  import { Sun, Moon, Server, Smartphone, Cloud } from 'lucide-svelte';

  let { data } = $props();

  const { stats, clients, user } = data;

  // Format date for display in local timezone
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    });
  }

  // Provider display names
  const providerNames: Record<string, string> = {
    google: 'Google',
    github: 'GitHub',
    magic_code: 'Magic Code',
  };

  // Theme toggle
  function toggleTheme() {
    theme.toggle();
  }

  let isDark = $derived($theme);
</script>

<svelte:head>
  <title>Admin Dashboard - Heartwood</title>
</svelte:head>

<main class="min-h-screen p-6 md:p-8">
  <!-- Header -->
  <header class="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
    <div class="flex items-center gap-4">
      <Logo size="sm" />
      <div>
        <h1 class="text-2xl font-serif text-bark dark:text-gray-100">Admin Dashboard</h1>
        <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">Heartwood Management</p>
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

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-1">Total Users</h3>
      <p class="text-3xl font-serif text-bark dark:text-gray-100">{stats.total_users}</p>
    </div>

    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-1">Registered Clients</h3>
      <p class="text-3xl font-serif text-bark dark:text-gray-100">{stats.total_clients}</p>
    </div>

    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-2">Sign-in Methods</h3>
      <div class="space-y-1">
        {#each Object.entries(stats.users_by_provider) as [provider, count]}
          <div class="flex justify-between text-sm">
            <span class="text-bark/60 dark:text-gray-400 font-sans">{providerNames[provider] || provider}</span>
            <span class="text-bark dark:text-gray-200 font-sans">{count}</span>
          </div>
        {/each}
        {#if Object.keys(stats.users_by_provider).length === 0}
          <p class="text-bark/40 dark:text-gray-500 text-sm font-sans italic">No data yet</p>
        {/if}
      </div>
    </div>

    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-2">Subscription Tiers</h3>
      <div class="space-y-1">
        {#each Object.entries(stats.users_by_tier) as [tier, count]}
          <div class="flex justify-between text-sm">
            <span class="text-bark/60 dark:text-gray-400 font-sans capitalize">{tier}</span>
            <span class="text-bark dark:text-gray-200 font-sans">{count}</span>
          </div>
        {/each}
        {#if Object.keys(stats.users_by_tier).length === 0}
          <p class="text-bark/40 dark:text-gray-500 text-sm font-sans italic">No subscriptions yet</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="mb-8">
    <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-3 uppercase tracking-wide">Quick Actions</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <a href="/dashboard/devices" class="card p-4 flex items-center gap-3 hover:bg-grove-50 dark:hover:bg-gray-700/50 transition-colors">
        <div class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700">
          <Smartphone size={20} class="text-grove-600 dark:text-grove-400" />
        </div>
        <div>
          <h4 class="font-serif text-bark dark:text-gray-100">Manage Devices</h4>
          <p class="text-xs text-bark/60 dark:text-gray-400 font-sans">View active sessions</p>
        </div>
      </a>
      <a href="/dashboard/minecraft" class="card p-4 flex items-center gap-3 hover:bg-grove-50 dark:hover:bg-gray-700/50 transition-colors">
        <div class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700">
          <Server size={20} class="text-grove-600 dark:text-grove-400" />
        </div>
        <div>
          <h4 class="font-serif text-bark dark:text-gray-100">Minecraft Server</h4>
          <p class="text-xs text-bark/60 dark:text-gray-400 font-sans">Manage server</p>
        </div>
      </a>
      <a href="/dashboard/cdn" class="card p-4 flex items-center gap-3 hover:bg-grove-50 dark:hover:bg-gray-700/50 transition-colors">
        <div class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700">
          <Cloud size={20} class="text-grove-600 dark:text-grove-400" />
        </div>
        <div>
          <h4 class="font-serif text-bark dark:text-gray-100">CDN Manager</h4>
          <p class="text-xs text-bark/60 dark:text-gray-400 font-sans">Upload files & assets</p>
        </div>
      </a>
    </div>
  </div>

  <!-- GroveEngine Stats -->
  <div class="mb-8">
    <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-3 uppercase tracking-wide">GroveEngine</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="card p-6">
        <h3 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-1">Email Signups</h3>
        <p class="text-3xl font-serif text-bark dark:text-gray-100">{stats.email_signups_count}</p>
      </div>
    </div>
  </div>

  <!-- D1 Replication Status -->
  {#if stats.replication}
    <div class="card p-4 mb-8 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-2 h-2 rounded-full {stats.replication.served_by_region ? 'bg-grove-500' : 'bg-amber-400'}"></div>
        <div>
          <span class="text-sm font-sans text-bark/60 dark:text-gray-400">D1 Read Replication:</span>
          {#if stats.replication.served_by_region}
            <span class="text-sm font-sans text-bark dark:text-gray-200 ml-1">
              Region <span class="font-mono text-grove-600 dark:text-grove-400">{stats.replication.served_by_region}</span>
              {#if stats.replication.served_by_primary === false}
                <span class="text-xs text-grove-500 dark:text-grove-400 ml-1">(replica)</span>
              {:else if stats.replication.served_by_primary === true}
                <span class="text-xs text-amber-600 dark:text-amber-400 ml-1">(primary)</span>
              {/if}
            </span>
          {:else}
            <span class="text-sm font-sans text-bark/50 dark:text-gray-500 ml-1">Not available (local dev or not enabled)</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Two Column Layout -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Clients List -->
    <div class="card p-6">
      <h3 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Registered Clients</h3>
      {#if clients && clients.length > 0}
        <div class="space-y-3">
          {#each clients as client}
            <div class="p-3 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-sans text-bark dark:text-gray-100 font-medium">{client.name}</p>
                  <p class="text-xs text-bark/50 dark:text-gray-400 font-mono">{client.client_id}</p>
                </div>
                {#if client.domain}
                  <span class="text-xs bg-grove-200/50 dark:bg-grove-700/50 text-grove-700 dark:text-grove-300 px-2 py-1 rounded font-sans">
                    {client.domain}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-bark/40 dark:text-gray-500 text-sm font-sans italic">No clients registered</p>
      {/if}
    </div>

    <!-- Recent Activity -->
    <div class="card p-6">
      <h3 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Recent Activity</h3>
      {#if stats.recent_logins && stats.recent_logins.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-grove-200 dark:border-gray-600">
                <th class="text-left py-2 text-bark/60 dark:text-gray-400 font-sans font-normal">Time</th>
                <th class="text-left py-2 text-bark/60 dark:text-gray-400 font-sans font-normal">Event</th>
                <th class="text-left py-2 text-bark/60 dark:text-gray-400 font-sans font-normal">IP</th>
              </tr>
            </thead>
            <tbody>
              {#each stats.recent_logins.slice(0, 10) as log}
                <tr class="border-b border-grove-100 dark:border-gray-700">
                  <td class="py-2 text-bark/70 dark:text-gray-300 font-sans text-xs">
                    {formatDate(log.created_at)}
                  </td>
                  <td class="py-2 text-bark dark:text-gray-200 font-sans">
                    <span class="inline-flex items-center gap-1">
                      <span class="w-2 h-2 bg-grove-400 rounded-full"></span>
                      {log.event_type}
                    </span>
                  </td>
                  <td class="py-2 text-bark/50 dark:text-gray-400 font-mono text-xs">{log.ip_address || '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-bark/40 dark:text-gray-500 text-sm font-sans italic">No recent activity</p>
      {/if}
    </div>
  </div>

  <!-- Quick Links -->
  <div class="mt-8">
    <h3 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Quick Links</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <a href="/dashboard/minecraft" class="card p-4 hover:border-grove-400 dark:hover:border-grove-600 transition-colors group">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-grove-100 dark:bg-gray-600 flex items-center justify-center group-hover:bg-grove-200 dark:group-hover:bg-gray-500 transition-colors">
            <Server size={20} strokeWidth={2} class="text-grove-600 dark:text-grove-400" />
          </div>
          <div>
            <p class="font-sans text-bark dark:text-gray-100 font-medium">Minecraft Server</p>
            <p class="text-xs text-bark/50 dark:text-gray-400 font-sans">On-demand server management</p>
          </div>
        </div>
      </a>
    </div>
  </div>

  <!-- Footer -->
  <footer class="mt-12 text-center">
    <div class="flex items-center justify-center gap-4 text-sm font-sans text-bark/50 dark:text-gray-500">
      <a href="/" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">Home</a>
      <span class="text-grove-300 dark:text-gray-600">·</span>
      <a href="https://autumnsgrove.com/admin" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">My Admin</a>
      <span class="text-grove-300 dark:text-gray-600">·</span>
      <a href="https://grove.place" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">Grove</a>
    </div>
  </footer>
</main>
