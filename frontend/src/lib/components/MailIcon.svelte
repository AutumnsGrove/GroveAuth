<script lang="ts">
  import { Mail } from 'lucide-svelte';

  interface Props {
    class?: string;
  }

  let { class: className = 'w-5 h-5' }: Props = $props();
</script>

<Mail class={className} />
