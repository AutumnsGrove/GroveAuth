<script lang="ts">
  import { AlertTriangle, CheckCircle, Clock, AlertCircle, Activity } from 'lucide-svelte';
  import StatusBadge from './components/StatusBadge.svelte';

  let { data } = $props();

  // Derived states
  const hasActiveIncidents = $derived(data.activeIncidents.length > 0);
  const overallStatus = $derived(hasActiveIncidents ? 'degraded' : 'operational');
</script>

<svelte:head>
  <title>Status Management - Heartwood</title>
</svelte:head>

<div class="min-h-screen p-6 md:p-8">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-serif text-bark dark:text-white mb-2">
      Status Management
    </h1>
    <p class="text-bark/60 dark:text-gray-400 font-sans">
      Manage platform incidents, component status, and scheduled maintenance
    </p>
  </div>

  <!-- Overall Status Banner -->
  <div class="mb-6">
    <div class="card p-6 border-2 {overallStatus === 'operational' ? 'border-green-500' : 'border-yellow-500'}">
      <div class="flex items-center gap-3">
        {#if overallStatus === 'operational'}
          <CheckCircle class="w-8 h-8 text-green-600" />
          <div>
            <h2 class="text-xl font-serif text-green-700 dark:text-green-400">
              All Systems Operational
            </h2>
            <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">
              No active incidents. Platform is running normally.
            </p>
          </div>
        {:else}
          <AlertTriangle class="w-8 h-8 text-yellow-600" />
          <div>
            <h2 class="text-xl font-serif text-yellow-700 dark:text-yellow-400">
              {data.activeIncidents.length} Active Incident{data.activeIncidents.length > 1 ? 's' : ''}
            </h2>
            <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">
              Platform experiencing issues. See details below.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Grid Layout -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
    <!-- Active Incidents -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-serif flex items-center gap-2">
          <AlertCircle class="w-5 h-5" />
          Active Incidents ({data.activeIncidents.length})
        </h3>
        <a href="/dashboard/status/incidents/new" class="btn-primary text-sm">
          + Report Incident
        </a>
      </div>

      {#if data.activeIncidents.length === 0}
        <p class="text-bark/40 dark:text-gray-400 text-sm font-sans">
          No active incidents. All systems operational.
        </p>
      {:else}
        <div class="space-y-3">
          {#each data.activeIncidents as incident}
            <a
              href="/dashboard/status/incidents/{incident.id}"
              class="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1">
                  <h4 class="font-medium text-bark dark:text-white font-serif mb-1">
                    {incident.title}
                  </h4>
                  <div class="flex items-center gap-2 text-sm">
                    <StatusBadge status={incident.status} />
                    <span class="text-bark/40 dark:text-gray-500">•</span>
                    <span class="text-bark/60 dark:text-gray-400 font-sans">
                      {new Date(incident.started_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <span class="badge badge-{incident.impact === 'critical' ? 'error' : incident.impact === 'major' ? 'warning' : 'info'}">
                  {incident.impact}
                </span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Scheduled Maintenance -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-serif flex items-center gap-2">
          <Clock class="w-5 h-5" />
          Scheduled Maintenance ({data.scheduled.length})
        </h3>
        <button class="btn-secondary text-sm" disabled>
          + Schedule
        </button>
      </div>

      {#if data.scheduled.length === 0}
        <p class="text-bark/40 dark:text-gray-400 text-sm font-sans">
          No upcoming maintenance scheduled.
        </p>
      {:else}
        <div class="space-y-3">
          {#each data.scheduled as maintenance}
            <div class="p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950">
              <h4 class="font-medium text-bark dark:text-white font-serif mb-1">
                {maintenance.title}
              </h4>
              <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">
                {new Date(maintenance.scheduled_start).toLocaleString()} - {new Date(maintenance.scheduled_end).toLocaleString()}
              </p>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Component Status Grid -->
  <div class="card p-6">
    <h3 class="text-lg font-serif mb-4 flex items-center gap-2">
      <Activity class="w-5 h-5" />
      Component Status
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each data.components as component}
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-bark dark:text-gray-100 font-serif">{component.name}</h4>
            <StatusBadge status={component.current_status} />
          </div>
          {#if component.description}
            <p class="text-sm text-bark/60 dark:text-gray-400 mb-3 font-sans">
              {component.description}
            </p>
          {/if}

          <!-- Status override dropdown -->
          <form method="POST" action="?/updateComponentStatus">
            <input type="hidden" name="slug" value={component.slug} />
            <select
              name="status"
              class="input-field text-sm w-full"
              onchange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <option value="operational" selected={component.current_status === 'operational'}>
                ✓ Operational
              </option>
              <option value="degraded" selected={component.current_status === 'degraded'}>
                ⚠ Degraded
              </option>
              <option value="partial_outage" selected={component.current_status === 'partial_outage'}>
                ⚠ Partial Outage
              </option>
              <option value="major_outage" selected={component.current_status === 'major_outage'}>
                ✗ Major Outage
              </option>
              <option value="maintenance" selected={component.current_status === 'maintenance'}>
                🔧 Maintenance
              </option>
            </select>
          </form>
        </div>
      {/each}
    </div>
  </div>
</div>
