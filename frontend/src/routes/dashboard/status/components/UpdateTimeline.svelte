<script lang="ts">
  import { Clock } from 'lucide-svelte';
  import StatusBadge from './StatusBadge.svelte';

  interface Update {
    id: string;
    status: string;
    message: string;
    created_at: string;
  }

  interface Props {
    updates: Update[];
  }

  let { updates }: Props = $props();

  // Format relative time
  function formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  }
</script>

<div class="space-y-6">
  {#each updates as update, i}
    <div class="flex gap-4">
      <!-- Timeline dot -->
      <div class="flex flex-col items-center">
        <div class="w-3 h-3 rounded-full bg-grove-500 ring-4 ring-grove-100 dark:ring-grove-900"></div>
        {#if i < updates.length - 1}
          <div class="w-0.5 h-full bg-gray-200 dark:bg-gray-700 mt-2"></div>
        {/if}
      </div>

      <!-- Update content -->
      <div class="flex-1 pb-6">
        <div class="flex items-center gap-3 mb-2">
          <StatusBadge status={update.status} />
          <span class="text-sm text-bark/60 dark:text-gray-400 flex items-center gap-1 font-sans">
            <Clock class="w-3 h-3" />
            {formatRelativeTime(update.created_at)}
          </span>
        </div>
        <p class="text-bark dark:text-gray-200 whitespace-pre-wrap font-sans">
          {update.message}
        </p>
        <time class="text-xs text-bark/40 dark:text-gray-500 mt-1 block font-sans">
          {new Date(update.created_at).toLocaleString()}
        </time>
      </div>
    </div>
  {/each}
</div>
