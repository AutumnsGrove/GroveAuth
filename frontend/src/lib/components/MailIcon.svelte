<script lang="ts">
  import { Mail } from 'lucide-svelte';

  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();
</script>

<Mail class={className || 'w-5 h-5'} />
