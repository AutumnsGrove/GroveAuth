<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { XCircle } from 'lucide-svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Error — Heartwood</title>
</svelte:head>

<main class="min-h-screen flex flex-col items-center justify-center px-6 py-12">
  <div class="mb-8">
    <a href="/" class="text-grove-600 hover:text-grove-700 transition-colors">
      <Logo size="md" />
    </a>
  </div>

  <div class="card-elevated w-full max-w-sm p-8 text-center">
    <div class="w-16 h-16 mx-auto mb-4 text-red-500 flex items-center justify-center">
      <XCircle size={64} strokeWidth={2} />
    </div>

    <h1 class="text-2xl font-serif text-bark mb-2">Something went wrong</h1>

    <div class="alert alert-error text-left mb-6">
      <p class="font-medium capitalize">{data.error.replace(/_/g, ' ')}</p>
      <p class="text-sm mt-1">{data.errorDescription}</p>
    </div>

    <div class="space-y-3">
      <button
        onclick={() => window.history.back()}
        class="btn-primary w-full"
      >
        Go Back
      </button>
      <a href="/" class="btn-secondary w-full text-center block">
        Back to Home
      </a>
    </div>
  </div>

  <p class="mt-8 text-sm text-bark/50 font-sans">
    Powered by <a href="https://heartwood.grove.place" class="hover:text-grove-600 transition-colors">Heartwood</a>
  </p>
</main>
