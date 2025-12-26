<script lang="ts">
  import { AUTH_API_URL } from '$lib/config';
  import { RotateCw, RotateCcw } from 'lucide-svelte';

  interface BackupInfo {
    id: string;
    filename: string;
    size: number;
    sizeFormatted: string;
    created: string;
  }

  interface WorldInfo {
    size: number;
    sizeFormatted: string;
    lastBackup: string | null;
    backupCount: number;
    hasWorld: boolean;
  }

  interface Props {
    accessToken: string;
    serverState: string;
    onRefresh: () => void;
  }

  let { accessToken, serverState, onRefresh }: Props = $props();

  let worldInfo = $state<WorldInfo | null>(null);
  let backups = $state<BackupInfo[]>([]);
  let isLoading = $state(false);
  let isResetting = $state(false);
  let isRestoring = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let showResetConfirm = $state(false);
  let resetConfirmInput = $state('');
  let showRestoreConfirm = $state(false);
  let restoreBackupId = $state<string | null>(null);

  // Can perform destructive operations only when server is offline
  let canModify = $derived(serverState === 'OFFLINE');

  // Format date
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Load world info
  async function loadWorldInfo() {
    isLoading = true;
    error = null;

    try {
      const [worldRes, backupsRes] = await Promise.all([
        fetch(`${AUTH_API_URL}/minecraft/world`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${AUTH_API_URL}/minecraft/backups?limit=10`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (worldRes.ok) {
        worldInfo = await worldRes.json();
      }

      if (backupsRes.ok) {
        const data = await backupsRes.json();
        backups = data.backups || [];
      }
    } catch (e) {
      error = 'Failed to load world info';
    } finally {
      isLoading = false;
    }
  }

  // Reset world
  async function resetWorld() {
    if (resetConfirmInput !== 'RESET WORLD') {
      error = 'Please type "RESET WORLD" to confirm';
      return;
    }

    isResetting = true;
    error = null;
    success = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/world`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Confirm-Delete': 'RESET_WORLD',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        error = data.error_description || data.error || 'Failed to reset world';
        return;
      }

      success = data.message || 'World reset successfully';
      showResetConfirm = false;
      resetConfirmInput = '';
      await loadWorldInfo();
      onRefresh();
    } catch (e) {
      error = 'Network error resetting world';
    } finally {
      isResetting = false;
    }
  }

  // Restore backup
  async function restoreBackup() {
    if (!restoreBackupId) return;

    isRestoring = true;
    error = null;
    success = null;

    try {
      const response = await fetch(
        `${AUTH_API_URL}/minecraft/backups/${restoreBackupId}/restore`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Confirm-Restore': 'RESTORE_BACKUP',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        error = data.error_description || data.error || 'Failed to restore backup';
        return;
      }

      success = data.message || 'Backup restored successfully';
      showRestoreConfirm = false;
      restoreBackupId = null;
      await loadWorldInfo();
      onRefresh();
    } catch (e) {
      error = 'Network error restoring backup';
    } finally {
      isRestoring = false;
    }
  }

  // Download backup
  function downloadBackup(backupId: string) {
    const url = `${AUTH_API_URL}/minecraft/backups/${backupId}/download`;
    // Create a temporary link with auth
    window.open(url, '_blank');
  }

  // Load on mount
  $effect(() => {
    loadWorldInfo();
  });
</script>

<div class="card p-6">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-serif text-bark dark:text-gray-100">World Manager</h3>
    <button
      onclick={() => loadWorldInfo()}
      disabled={isLoading}
      class="p-1.5 rounded-lg hover:bg-grove-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
      title="Refresh"
    >
      <div class:animate-spin={isLoading}>
        <RotateCw
          size={16}
          strokeWidth={2}
          class="text-bark/60 dark:text-gray-400"
        />
      </div>
    </button>
  </div>

  {#if error}
    <div class="alert-error mb-4 flex items-center justify-between">
      <span>{error}</span>
      <button onclick={() => (error = null)} class="text-red-700 hover:text-red-900">&times;</button>
    </div>
  {/if}

  {#if success}
    <div class="alert-success mb-4 flex items-center justify-between">
      <span>{success}</span>
      <button onclick={() => (success = null)} class="text-grove-700 hover:text-grove-900">&times;</button>
    </div>
  {/if}

  {#if !canModify}
    <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
      <p class="text-sm text-yellow-800 dark:text-yellow-200">
        Server must be offline to manage world.
      </p>
    </div>
  {/if}

  <!-- World Info -->
  <div class="grid grid-cols-2 gap-4 mb-4">
    <div class="p-3 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg">
      <p class="text-xs text-bark/60 dark:text-gray-400">World Size</p>
      <p class="text-lg font-serif text-bark dark:text-gray-100">
        {worldInfo?.sizeFormatted || '0 B'}
      </p>
    </div>
    <div class="p-3 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg">
      <p class="text-xs text-bark/60 dark:text-gray-400">Last Backup</p>
      <p class="text-lg font-serif text-bark dark:text-gray-100">
        {formatDate(worldInfo?.lastBackup || null)}
      </p>
    </div>
  </div>

  <!-- Actions -->
  <div class="flex gap-2 mb-4">
    <button
      onclick={() => (showResetConfirm = true)}
      disabled={!canModify || isResetting}
      class="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
    >
      Reset World
    </button>
  </div>

  <!-- Backups List -->
  <div class="mt-4">
    <h4 class="text-sm font-sans text-bark/60 dark:text-gray-400 mb-2">
      Recent Backups ({backups.length})
    </h4>
    <div class="max-h-48 overflow-y-auto space-y-1">
      {#if backups.length === 0}
        <p class="text-bark/40 dark:text-gray-500 text-sm italic">No backups available</p>
      {:else}
        {#each backups as backup}
          <div
            class="flex items-center justify-between p-2 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-sans text-bark dark:text-gray-100">
                {formatDate(backup.created)}
              </p>
              <p class="text-xs text-bark/50 dark:text-gray-400">
                {backup.sizeFormatted}
              </p>
            </div>
            <div class="flex gap-1 ml-2">
              <button
                onclick={() => {
                  restoreBackupId = backup.id;
                  showRestoreConfirm = true;
                }}
                disabled={!canModify}
                class="p-1.5 text-grove-600 hover:text-grove-700 dark:text-grove-400 dark:hover:text-grove-300 disabled:opacity-30"
                title="Restore this backup"
              >
                <RotateCcw size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<!-- Reset Confirmation Modal -->
{#if showResetConfirm}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
      <h4 class="text-lg font-serif text-bark dark:text-gray-100 mb-2">Reset World?</h4>
      <p class="text-sm text-bark/70 dark:text-gray-300 mb-4">
        This will permanently delete the current world. A fresh world will be generated on the next server start. This action cannot be undone.
      </p>
      <div class="mb-4">
        <label class="block text-sm text-bark/60 dark:text-gray-400 mb-1">
          Type "RESET WORLD" to confirm:
        </label>
        <input
          type="text"
          bind:value={resetConfirmInput}
          class="input-field w-full"
          placeholder="RESET WORLD"
        />
      </div>
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => {
            showResetConfirm = false;
            resetConfirmInput = '';
          }}
          class="btn-secondary px-4 py-2"
        >
          Cancel
        </button>
        <button
          onclick={resetWorld}
          disabled={resetConfirmInput !== 'RESET WORLD' || isResetting}
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {isResetting ? 'Resetting...' : 'Reset World'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Restore Confirmation Modal -->
{#if showRestoreConfirm}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
      <h4 class="text-lg font-serif text-bark dark:text-gray-100 mb-2">Restore Backup?</h4>
      <p class="text-sm text-bark/70 dark:text-gray-300 mb-4">
        This will replace the current world with the selected backup. The current world will be lost.
      </p>
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => {
            showRestoreConfirm = false;
            restoreBackupId = null;
          }}
          class="btn-secondary px-4 py-2"
        >
          Cancel
        </button>
        <button
          onclick={restoreBackup}
          disabled={isRestoring}
          class="btn-primary px-4 py-2"
        >
          {isRestoring ? 'Restoring...' : 'Restore Backup'}
        </button>
      </div>
    </div>
  </div>
{/if}
