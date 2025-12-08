<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';

  let { data } = $props();

  const { stats, clients, user } = data;

  // Format date for display
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  // Provider display names
  const providerNames: Record<string, string> = {
    google: 'Google',
    github: 'GitHub',
    magic_code: 'Magic Code',
  };
</script>

<svelte:head>
  <title>Admin Dashboard - GroveAuth</title>
</svelte:head>

<main class="min-h-screen p-6 md:p-8">
  <!-- Header -->
  <header class="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
    <div class="flex items-center gap-4">
      <Logo size="sm" />
      <div>
        <h1 class="text-2xl font-serif text-bark">Admin Dashboard</h1>
        <p class="text-sm text-bark/60 font-sans">GroveAuth Management</p>
      </div>
    </div>
    <div class="text-sm text-bark/60 font-sans">
      Logged in as <span class="text-bark">{user?.email}</span>
    </div>
  </header>

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 mb-1">Total Users</h3>
      <p class="text-3xl font-serif text-bark">{stats.total_users}</p>
    </div>

    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 mb-1">Registered Clients</h3>
      <p class="text-3xl font-serif text-bark">{stats.total_clients}</p>
    </div>

    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 mb-2">Sign-in Methods</h3>
      <div class="space-y-1">
        {#each Object.entries(stats.users_by_provider) as [provider, count]}
          <div class="flex justify-between text-sm">
            <span class="text-bark/60 font-sans">{providerNames[provider] || provider}</span>
            <span class="text-bark font-sans">{count}</span>
          </div>
        {/each}
        {#if Object.keys(stats.users_by_provider).length === 0}
          <p class="text-bark/40 text-sm font-sans italic">No data yet</p>
        {/if}
      </div>
    </div>

    <div class="card p-6">
      <h3 class="text-sm font-sans text-bark/60 mb-2">Subscription Tiers</h3>
      <div class="space-y-1">
        {#each Object.entries(stats.users_by_tier) as [tier, count]}
          <div class="flex justify-between text-sm">
            <span class="text-bark/60 font-sans capitalize">{tier}</span>
            <span class="text-bark font-sans">{count}</span>
          </div>
        {/each}
        {#if Object.keys(stats.users_by_tier).length === 0}
          <p class="text-bark/40 text-sm font-sans italic">No subscriptions yet</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Two Column Layout -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Clients List -->
    <div class="card p-6">
      <h3 class="text-lg font-serif text-bark mb-4">Registered Clients</h3>
      {#if clients && clients.length > 0}
        <div class="space-y-3">
          {#each clients as client}
            <div class="p-3 bg-grove-50/50 rounded-lg">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-sans text-bark font-medium">{client.name}</p>
                  <p class="text-xs text-bark/50 font-mono">{client.client_id}</p>
                </div>
                {#if client.domain}
                  <span class="text-xs bg-grove-200/50 text-grove-700 px-2 py-1 rounded font-sans">
                    {client.domain}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-bark/40 text-sm font-sans italic">No clients registered</p>
      {/if}
    </div>

    <!-- Recent Activity -->
    <div class="card p-6">
      <h3 class="text-lg font-serif text-bark mb-4">Recent Activity</h3>
      {#if stats.recent_logins && stats.recent_logins.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-grove-200">
                <th class="text-left py-2 text-bark/60 font-sans font-normal">Time</th>
                <th class="text-left py-2 text-bark/60 font-sans font-normal">Event</th>
                <th class="text-left py-2 text-bark/60 font-sans font-normal">IP</th>
              </tr>
            </thead>
            <tbody>
              {#each stats.recent_logins.slice(0, 10) as log}
                <tr class="border-b border-grove-100">
                  <td class="py-2 text-bark/70 font-sans text-xs">
                    {formatDate(log.created_at)}
                  </td>
                  <td class="py-2 text-bark font-sans">
                    <span class="inline-flex items-center gap-1">
                      <span class="w-2 h-2 bg-grove-400 rounded-full"></span>
                      {log.event_type}
                    </span>
                  </td>
                  <td class="py-2 text-bark/50 font-mono text-xs">{log.ip_address || '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-bark/40 text-sm font-sans italic">No recent activity</p>
      {/if}
    </div>
  </div>

  <!-- Footer -->
  <footer class="mt-12 text-center">
    <div class="flex items-center justify-center gap-4 text-sm font-sans text-bark/50">
      <a href="/" class="hover:text-grove-600 transition-colors">Home</a>
      <span class="text-grove-300">·</span>
      <a href="https://grove.place" class="hover:text-grove-600 transition-colors">Grove</a>
    </div>
  </footer>
</main>
