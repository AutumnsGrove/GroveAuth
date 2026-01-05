<script lang="ts">
  import { Mail } from 'lucide-svelte';

  interface Props {
    class?: string;
  }

  let { class: className = 'w-5 h-5' }: Props = $props();
</script>

<!-- Google OAuth branded wrapper using Lucide Mail as base -->
<div class="relative inline-flex">
  <Mail class="{className} text-[#4285F4]" />
  <div class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#34A853] rounded-full"></div>
  <div class="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 bg-[#FBBC05] rounded-full"></div>
</div>
