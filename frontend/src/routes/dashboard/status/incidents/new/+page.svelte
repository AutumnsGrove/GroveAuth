<script lang="ts">
  import { enhance } from '$app/forms';
  import { AlertTriangle } from 'lucide-svelte';
  import ComponentSelector from '../../components/ComponentSelector.svelte';

  let { data, form } = $props();

  let selectedComponents = $state<string[]>([]);
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Report New Incident - Heartwood</title>
</svelte:head>

<div class="min-h-screen p-6 md:p-8">
  <!-- Breadcrumb -->
  <div class="mb-4">
    <a href="/dashboard/status" class="text-grove-600 hover:text-grove-700 text-sm font-sans">
      ← Back to Status Dashboard
    </a>
  </div>

  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-serif text-bark dark:text-white mb-2 flex items-center gap-3">
      <AlertTriangle class="w-8 h-8 text-orange-500" />
      Report New Incident
    </h1>
    <p class="text-bark/60 dark:text-gray-400 font-sans">
      Create a new incident to inform users about platform issues
    </p>
  </div>

  <!-- Success/Error Messages -->
  {#if form?.success}
    <div class="alert alert-success mb-6">
      Incident created successfully! Redirecting...
    </div>
  {/if}

  {#if form?.error}
    <div class="alert alert-error mb-6">
      {form.error}
    </div>
  {/if}

  <!-- Form -->
  <div class="card p-8 max-w-3xl">
    <form method="POST" action="?/createIncident" use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}>
      <!-- Title -->
      <div class="mb-6">
        <label for="title" class="block font-medium mb-2 font-serif">
          Incident Title <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          class="input-field w-full"
          placeholder="e.g., CDN Experiencing Slowness"
          required
        />
        <p class="text-sm text-bark/40 dark:text-gray-500 mt-1 font-sans">
          Keep it brief and descriptive. This appears on the status page.
        </p>
      </div>

      <!-- Type & Impact Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <!-- Type -->
        <div>
          <label for="type" class="block font-medium mb-2 font-serif">
            Incident Type <span class="text-red-500">*</span>
          </label>
          <select id="type" name="type" class="input-field w-full" required>
            <option value="">-- Select Type --</option>
            <option value="outage">Outage</option>
            <option value="degraded">Degraded Performance</option>
            <option value="maintenance">Planned Maintenance</option>
            <option value="security">Security Incident</option>
          </select>
        </div>

        <!-- Impact -->
        <div>
          <label for="impact" class="block font-medium mb-2 font-serif">
            Impact Level <span class="text-red-500">*</span>
          </label>
          <select id="impact" name="impact" class="input-field w-full" required>
            <option value="">-- Select Impact --</option>
            <option value="minor">Minor - Limited functionality affected</option>
            <option value="major">Major - Significant functionality affected</option>
            <option value="critical">Critical - Service unavailable</option>
          </select>
        </div>
      </div>

      <!-- Affected Components -->
      <div class="mb-6">
        <label class="block font-medium mb-2 font-serif">
          Affected Components <span class="text-red-500">*</span>
        </label>
        <ComponentSelector
          components={data.components}
          bind:selected={selectedComponents}
        />
        <input type="hidden" name="components" value={JSON.stringify(selectedComponents)} />
        <p class="text-sm text-bark/40 dark:text-gray-500 mt-1 font-sans">
          Select all components experiencing issues
        </p>
      </div>

      <!-- Initial Status -->
      <div class="mb-6">
        <label for="initialStatus" class="block font-medium mb-2 font-serif">
          Initial Status <span class="text-red-500">*</span>
        </label>
        <select id="initialStatus" name="initialStatus" class="input-field w-full" required>
          <option value="investigating">🔍 Investigating - We're aware and looking into it</option>
          <option value="identified">✓ Identified - Root cause found, working on fix</option>
        </select>
      </div>

      <!-- Initial Message -->
      <div class="mb-8">
        <label for="initialMessage" class="block font-medium mb-2 font-serif">
          Initial Update Message <span class="text-red-500">*</span>
        </label>
        <textarea
          id="initialMessage"
          name="initialMessage"
          class="input-field w-full"
          rows="4"
          placeholder="What you know so far... e.g., 'We're investigating reports of slow image loading in the CDN. Our team is looking into the issue.'"
          required
        ></textarea>
        <p class="text-sm text-bark/40 dark:text-gray-500 mt-1 font-sans">
          This appears as the first timeline update on the public status page
        </p>
      </div>

      <!-- Submit Buttons -->
      <div class="flex items-center gap-3">
        <button
          type="submit"
          class="btn-primary"
          disabled={submitting || selectedComponents.length === 0}
        >
          {submitting ? 'Creating...' : 'Create Incident'}
        </button>
        <a href="/dashboard/status" class="btn-secondary">
          Cancel
        </a>
      </div>
    </form>
  </div>
</div>
