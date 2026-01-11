<script lang="ts">
  import { enhance } from '$app/forms';
  import { CheckCircle, AlertCircle, Clock } from 'lucide-svelte';
  import StatusBadge from '../../components/StatusBadge.svelte';
  import UpdateTimeline from '../../components/UpdateTimeline.svelte';

  let { data, form } = $props();

  let newUpdateMessage = $state('');
  let newUpdateStatus = $state('monitoring');
  let submitting = $state(false);

  const isResolved = $derived(!!data.incident.resolved_at);
</script>

<svelte:head>
  <title>{data.incident.title} - Heartwood</title>
</svelte:head>

<div class="min-h-screen p-6 md:p-8">
  <!-- Breadcrumb -->
  <div class="mb-4">
    <a href="/dashboard/status" class="text-grove-600 hover:text-grove-700 text-sm font-sans">
      ← Back to Status Dashboard
    </a>
  </div>

  <!-- Incident Header -->
  <div class="mb-8">
    <div class="flex items-start justify-between gap-4 mb-4">
      <div class="flex-1">
        <h1 class="text-3xl font-serif text-bark dark:text-white mb-2">
          {data.incident.title}
        </h1>
        <div class="flex items-center gap-3 flex-wrap">
          <StatusBadge status={data.incident.status} />
          <span class="badge badge-{data.incident.impact === 'critical' ? 'error' : data.incident.impact === 'major' ? 'warning' : 'info'}">
            {data.incident.impact} impact
          </span>
          <span class="text-sm text-bark/60 dark:text-gray-400 font-sans">
            Started {new Date(data.incident.started_at).toLocaleString()}
          </span>
          {#if isResolved}
            <span class="text-sm text-green-600 dark:text-green-400 flex items-center gap-1 font-sans">
              <CheckCircle class="w-4 h-4" />
              Resolved {new Date(data.incident.resolved_at).toLocaleString()}
            </span>
          {/if}
        </div>
      </div>

      {#if !isResolved}
        <form method="POST" action="?/resolve">
          <button type="submit" class="btn-primary flex items-center gap-2">
            <CheckCircle class="w-4 h-4" />
            Mark as Resolved
          </button>
        </form>
      {/if}
    </div>

    <!-- Affected Components -->
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-sm font-medium text-bark/60 dark:text-gray-300 font-sans">Affected:</span>
      {#each data.incident.components as component}
        <span class="badge badge-secondary">{component.name}</span>
      {/each}
    </div>
  </div>

  <!-- Post New Update Form -->
  {#if !isResolved}
    <div class="card p-6 mb-8">
      <h2 class="text-xl font-serif mb-4 flex items-center gap-2">
        <AlertCircle class="w-5 h-5" />
        Post Update
      </h2>

      {#if form?.success}
        <div class="alert alert-success mb-4">
          Update posted successfully!
        </div>
      {/if}

      <form method="POST" action="?/postUpdate" use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          await update();
          submitting = false;
          newUpdateMessage = ''; // Clear form on success
        };
      }}>
        <div class="mb-4">
          <label for="status" class="block font-medium mb-2 font-serif">
            Status
          </label>
          <select
            id="status"
            name="status"
            class="input-field w-full sm:w-auto"
            bind:value={newUpdateStatus}
            required
          >
            <option value="investigating">🔍 Investigating</option>
            <option value="identified">✓ Identified</option>
            <option value="monitoring">👁 Monitoring</option>
          </select>
        </div>

        <div class="mb-4">
          <label for="message" class="block font-medium mb-2 font-serif">
            Update Message
          </label>
          <textarea
            id="message"
            name="message"
            class="input-field w-full"
            rows="3"
            placeholder="What's the latest status? What actions have been taken?"
            bind:value={newUpdateMessage}
            required
          ></textarea>
        </div>

        <button type="submit" class="btn-primary" disabled={submitting || !newUpdateMessage.trim()}>
          {submitting ? 'Posting...' : 'Post Update'}
        </button>
      </form>
    </div>
  {/if}

  <!-- Timeline -->
  <div class="card p-6">
    <h2 class="text-xl font-serif mb-6 flex items-center gap-2">
      <Clock class="w-5 h-5" />
      Timeline
    </h2>

    <UpdateTimeline updates={data.incident.updates} />
  </div>
</div>
