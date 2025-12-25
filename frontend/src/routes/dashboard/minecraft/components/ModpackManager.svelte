<script lang="ts">
  import { AUTH_API_URL } from '$lib/config';
  import { RotateCw, X } from 'lucide-svelte';

  interface ModInfo {
    filename: string;
    size: number;
    uploaded: string;
  }

  interface Props {
    accessToken: string;
    serverState: string;
    onRefresh: () => void;
  }

  let { accessToken, serverState, onRefresh }: Props = $props();

  let mods = $state<ModInfo[]>([]);
  let totalSize = $state(0);
  let totalSizeFormatted = $state('0 B');
  let isLoading = $state(false);
  let isDeleting = $state(false);
  let isUploading = $state(false);
  let uploadProgress = $state(0);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let showDeleteConfirm = $state(false);
  let deleteConfirmInput = $state('');
  let searchQuery = $state('');
  let fileInput: HTMLInputElement;

  // Filtered mods based on search
  let filteredMods = $derived(
    searchQuery
      ? mods.filter((m) =>
          m.filename.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : mods
  );

  // Can perform destructive operations only when server is offline
  let canModify = $derived(serverState === 'OFFLINE');

  // Format bytes
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  // Load mods from API
  async function loadMods() {
    isLoading = true;
    error = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/mods`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        error = data.error_description || data.error || 'Failed to load mods';
        return;
      }

      mods = data.mods || [];
      totalSize = data.totalSize || 0;
      totalSizeFormatted = data.totalSizeFormatted || formatBytes(totalSize);
    } catch (e) {
      error = 'Network error loading mods';
    } finally {
      isLoading = false;
    }
  }

  // Delete all mods
  async function deleteAllMods() {
    if (deleteConfirmInput !== 'DELETE ALL MODS') {
      error = 'Please type "DELETE ALL MODS" to confirm';
      return;
    }

    isDeleting = true;
    error = null;
    success = null;

    try {
      const response = await fetch(`${AUTH_API_URL}/minecraft/mods`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Confirm-Delete': 'DELETE_ALL_MODS',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        error = data.error_description || data.error || 'Failed to delete mods';
        return;
      }

      success = `Deleted ${data.deleted} mods (${data.freedFormatted} freed)`;
      showDeleteConfirm = false;
      deleteConfirmInput = '';
      await loadMods();
    } catch (e) {
      error = 'Network error deleting mods';
    } finally {
      isDeleting = false;
    }
  }

  // Delete single mod
  async function deleteMod(filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return;

    error = null;

    try {
      const response = await fetch(
        `${AUTH_API_URL}/minecraft/mods/${encodeURIComponent(filename)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        error = data.error_description || data.error || 'Failed to delete mod';
        return;
      }

      success = `Deleted ${filename}`;
      await loadMods();
    } catch (e) {
      error = 'Network error deleting mod';
    }
  }

  // Handle file upload
  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    isUploading = true;
    error = null;
    success = null;
    uploadProgress = 0;

    const totalFiles = files.length;
    let uploaded = 0;
    let failed = 0;

    for (const file of files) {
      if (!file.name.endsWith('.jar')) {
        failed++;
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${AUTH_API_URL}/minecraft/mods/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });

        if (response.ok) {
          uploaded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }

      uploadProgress = Math.round(((uploaded + failed) / totalFiles) * 100);
    }

    isUploading = false;
    uploadProgress = 0;

    if (uploaded > 0) {
      success = `Uploaded ${uploaded} mod${uploaded > 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`;
      await loadMods();
    } else if (failed > 0) {
      error = `Failed to upload ${failed} file${failed > 1 ? 's' : ''}`;
    }

    // Clear file input
    input.value = '';
  }

  // Load mods on mount
  $effect(() => {
    loadMods();
  });
</script>

<div class="card p-6">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-serif text-bark dark:text-gray-100">Modpack Manager</h3>
    <div class="flex items-center gap-2">
      <span class="text-sm text-bark/60 dark:text-gray-400">
        {mods.length} mods ({totalSizeFormatted})
      </span>
      <button
        onclick={() => loadMods()}
        disabled={isLoading}
        class="p-1.5 rounded-lg hover:bg-grove-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        title="Refresh"
      >
        <RotateCw
          size={16}
          strokeWidth={2}
          class="text-bark/60 dark:text-gray-400"
          class:animate-spin={isLoading}
        />
      </button>
    </div>
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
        Server must be offline to modify mods.
      </p>
    </div>
  {/if}

  <!-- Actions Row -->
  <div class="flex flex-wrap gap-2 mb-4">
    <input
      bind:this={fileInput}
      type="file"
      accept=".jar"
      multiple
      class="hidden"
      onchange={handleFileUpload}
      disabled={!canModify || isUploading}
    />
    <button
      onclick={() => fileInput?.click()}
      disabled={!canModify || isUploading}
      class="btn-primary text-sm px-4 py-2 disabled:opacity-50"
    >
      {#if isUploading}
        Uploading... {uploadProgress}%
      {:else}
        Upload Mods
      {/if}
    </button>

    <button
      onclick={() => (showDeleteConfirm = true)}
      disabled={!canModify || mods.length === 0 || isDeleting}
      class="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
    >
      Delete All Mods
    </button>
  </div>

  <!-- Search -->
  <div class="mb-4">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search mods..."
      class="input-field w-full text-sm"
    />
  </div>

  <!-- Mod List -->
  <div class="max-h-64 overflow-y-auto space-y-1">
    {#if isLoading && mods.length === 0}
      <p class="text-bark/40 dark:text-gray-500 text-sm italic">Loading...</p>
    {:else if filteredMods.length === 0}
      <p class="text-bark/40 dark:text-gray-500 text-sm italic">
        {searchQuery ? 'No mods match your search' : 'No mods installed'}
      </p>
    {:else}
      {#each filteredMods as mod}
        <div
          class="flex items-center justify-between p-2 bg-grove-50/50 dark:bg-gray-600/50 rounded-lg hover:bg-grove-100/50 dark:hover:bg-gray-600"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-sans text-bark dark:text-gray-100 truncate" title={mod.filename}>
              {mod.filename}
            </p>
            <p class="text-xs text-bark/50 dark:text-gray-400">
              {formatBytes(mod.size)}
            </p>
          </div>
          <button
            onclick={() => deleteMod(mod.filename)}
            disabled={!canModify}
            class="ml-2 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-30"
            title="Delete mod"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
      <h4 class="text-lg font-serif text-bark dark:text-gray-100 mb-2">Delete All Mods?</h4>
      <p class="text-sm text-bark/70 dark:text-gray-300 mb-4">
        This will permanently delete all {mods.length} mods ({totalSizeFormatted}).
        This action cannot be undone.
      </p>
      <div class="mb-4">
        <label class="block text-sm text-bark/60 dark:text-gray-400 mb-1">
          Type "DELETE ALL MODS" to confirm:
        </label>
        <input
          type="text"
          bind:value={deleteConfirmInput}
          class="input-field w-full"
          placeholder="DELETE ALL MODS"
        />
      </div>
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => {
            showDeleteConfirm = false;
            deleteConfirmInput = '';
          }}
          class="btn-secondary px-4 py-2"
        >
          Cancel
        </button>
        <button
          onclick={deleteAllMods}
          disabled={deleteConfirmInput !== 'DELETE ALL MODS' || isDeleting}
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete All'}
        </button>
      </div>
    </div>
  </div>
{/if}
