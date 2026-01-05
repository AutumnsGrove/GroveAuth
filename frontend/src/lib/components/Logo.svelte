<script lang="ts">
  import { ShieldCheck } from 'lucide-svelte';

  interface Props {
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  }

  let { size = 'md', class: className = '' }: Props = $props();

  const sizes = {
    sm: 48,
    md: 64,
    lg: 80
  };
</script>

<ShieldCheck
  size={sizes[size]}
  class="text-grove-600 dark:text-grove-400 {className} w-auto h-auto"
/>
