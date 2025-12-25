<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { AlertTriangle } from 'lucide-svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Authentication Error — GroveAuth</title>
</svelte:head>

<main class="min-h-screen flex flex-col items-center justify-center px-6 py-12">
  <div class="mb-8">
    <Logo size="md" />
  </div>

  <div class="card-elevated w-full max-w-sm p-8 text-center">
    <!-- Error State (success redirects server-side, so we only show errors) -->
    <div class="w-16 h-16 mx-auto mb-4 text-red-500 flex items-center justify-center">
      <AlertTriangle size={64} strokeWidth={2} />
    </div>
    <h1 class="text-2xl font-serif text-bark mb-2">Authentication Failed</h1>
    <div class="alert alert-error text-left mb-6">
      <p class="font-medium">{data.error || 'Unknown error'}</p>
      {#if data.errorDescription}
        <p class="text-sm mt-1">{data.errorDescription}</p>
      {/if}
    </div>
    <a href="/" class="btn-secondary w-full text-center block">
      Try Again
    </a>
  </div>

  <p class="mt-8 text-sm text-bark/50 font-sans">
    Powered by <a href="https://grove.place" class="hover:text-grove-600 transition-colors">GroveAuth</a>
  </p>
</main>
