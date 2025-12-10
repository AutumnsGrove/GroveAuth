<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme } from '$lib/theme';

  let { children } = $props();

  onMount(() => {
    theme.init();
  });

  // Re-apply theme whenever store changes
  $effect(() => {
    theme.apply();
  });
</script>

<div class="min-h-screen">
  {@render children()}
</div>
