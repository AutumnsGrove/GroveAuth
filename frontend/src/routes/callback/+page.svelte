<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.success ? 'Success' : 'Error'} — GroveAuth</title>
</svelte:head>

<main class="min-h-screen flex flex-col items-center justify-center px-6 py-12">
  <div class="mb-8">
    <Logo size="md" />
  </div>

  <div class="card-elevated w-full max-w-sm p-8 text-center">
    {#if data.success}
      <!-- Success State -->
      <div class="w-16 h-16 mx-auto mb-4 text-grove-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 class="text-2xl font-serif text-bark mb-2">Success!</h1>
      <p class="text-bark/60 font-sans mb-4">{data.message}</p>
      <p class="text-bark/40 font-sans text-sm animate-pulse-soft">
        You should be redirected automatically...
      </p>
    {:else}
      <!-- Error State -->
      <div class="w-16 h-16 mx-auto mb-4 text-red-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h1 class="text-2xl font-serif text-bark mb-2">Authentication Failed</h1>
      <div class="alert alert-error text-left mb-6">
        <p class="font-medium">{data.error}</p>
        {#if data.errorDescription}
          <p class="text-sm mt-1">{data.errorDescription}</p>
        {/if}
      </div>
      <a href="/" class="btn-secondary w-full text-center block">
        Back to Home
      </a>
    {/if}
  </div>

  <p class="mt-8 text-sm text-bark/50 font-sans">
    Powered by <a href="https://grove.place" class="hover:text-grove-600 transition-colors">GroveAuth</a>
  </p>
</main>
