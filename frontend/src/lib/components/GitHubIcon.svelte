<script lang="ts">
  import { Github } from 'lucide-svelte';

  interface Props {
    class?: string;
  }

  let { class: className = 'w-5 h-5' }: Props = $props();
</script>

<Github class={className} />
