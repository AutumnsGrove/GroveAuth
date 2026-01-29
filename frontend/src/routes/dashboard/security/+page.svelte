<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { theme } from '$lib/theme';
  import { Sun, Moon, ArrowLeft, KeyRound, Trash2, Plus, Check, Smartphone, Laptop, Monitor, Loader2 } from 'lucide-svelte';
  import { enhance } from '$app/forms';
  import { registerPasskey } from '$lib/auth/client';
  import { invalidateAll } from '$app/navigation';

  let { data, form } = $props();

  const { passkeys, user, error } = data;

  // Format date for display
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Get device icon based on passkey name or device type
  function getDeviceIcon(name: string, deviceType?: string) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile') || lower.includes('phone')) {
      return Smartphone;
    }
    if (lower.includes('mac') || lower.includes('windows') || lower.includes('linux') || lower.includes('laptop')) {
      return Laptop;
    }
    // Default based on device type from WebAuthn
    if (deviceType === 'singleDevice') {
      return KeyRound; // Hardware security key
    }
    return Monitor;
  }

  // Theme toggle
  function toggleTheme() {
    theme.toggle();
  }

  let isDark = $derived($theme);

  // Track states
  let deletingPasskey = $state<string | null>(null);
  let isRegistering = $state(false);
  let registerError = $state<string | null>(null);
  let registerSuccess = $state(false);

  // Register a new passkey
  async function handleRegisterPasskey() {
    isRegistering = true;
    registerError = null;
    registerSuccess = false;

    try {
      // Get a descriptive name based on platform
      const platform = navigator.platform || '';
      let defaultName = 'My Passkey';
      if (platform.includes('Mac')) {
        defaultName = 'MacBook';
      } else if (platform.includes('iPhone')) {
        defaultName = 'iPhone';
      } else if (platform.includes('iPad')) {
        defaultName = 'iPad';
      } else if (platform.includes('Win')) {
        defaultName = 'Windows PC';
      } else if (platform.includes('Linux')) {
        defaultName = 'Linux PC';
      } else if (platform.includes('Android')) {
        defaultName = 'Android Device';
      }

      const result = await registerPasskey(defaultName);

      if (result.error) {
        registerError = result.error.message || 'Failed to register passkey. Please try again.';
      } else {
        registerSuccess = true;
        // Refresh the page data to show the new passkey
        await invalidateAll();
      }
    } catch (e) {
      console.error('Passkey registration error:', e);
      registerError = 'Failed to register passkey. Please try again.';
    } finally {
      isRegistering = false;
    }
  }

  // Check if passkeys are supported
  let supportsPasskeys = $state(false);

  $effect(() => {
    // Check WebAuthn support
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then((available) => {
          supportsPasskeys = available;
        })
        .catch(() => {
          supportsPasskeys = false;
        });
    }
  });
</script>

<svelte:head>
  <title>Security - Heartwood</title>
</svelte:head>

<main class="min-h-screen p-6 md:p-8">
  <!-- Header -->
  <header class="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
    <div class="flex items-center gap-4">
      <a href="/dashboard" class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700 hover:bg-grove-200 dark:hover:bg-gray-600 transition-colors">
        <ArrowLeft size={20} class="text-bark dark:text-gray-300" />
      </a>
      <Logo size="sm" />
      <div>
        <h1 class="text-2xl font-serif text-bark dark:text-gray-100">Security</h1>
        <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">Manage your passkeys and sign-in methods</p>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm text-bark/60 dark:text-gray-400 font-sans">
        Logged in as <span class="text-bark dark:text-gray-200">{user?.email}</span>
      </span>
      <button
        onclick={toggleTheme}
        class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700 hover:bg-grove-200 dark:hover:bg-gray-600 transition-colors"
        aria-label="Toggle theme"
      >
        {#if isDark}
          <Sun size={20} class="text-yellow-400" />
        {:else}
          <Moon size={20} class="text-gray-700" />
        {/if}
      </button>
    </div>
  </header>

  <!-- Status Messages -->
  {#if form?.success}
    <div class="mb-6 p-4 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
      <p class="text-green-800 dark:text-green-300 font-sans flex items-center gap-2">
        <Check size={18} />
        {form.message}
      </p>
    </div>
  {/if}

  {#if form?.error || error}
    <div class="mb-6 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
      <p class="text-red-800 dark:text-red-300 font-sans">{form?.error || error}</p>
    </div>
  {/if}

  {#if registerError}
    <div class="mb-6 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
      <p class="text-red-800 dark:text-red-300 font-sans">{registerError}</p>
    </div>
  {/if}

  {#if registerSuccess}
    <div class="mb-6 p-4 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
      <p class="text-green-800 dark:text-green-300 font-sans flex items-center gap-2">
        <Check size={18} />
        Passkey registered successfully!
      </p>
    </div>
  {/if}

  <!-- Passkeys Section -->
  <div class="card p-6 mb-6">
    <div class="flex items-start justify-between mb-6">
      <div>
        <h2 class="text-lg font-serif text-bark dark:text-gray-100 mb-1">Passkeys</h2>
        <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">
          Sign in faster with Face ID, Touch ID, Windows Hello, or a security key
        </p>
      </div>
      {#if supportsPasskeys}
        <button
          onclick={handleRegisterPasskey}
          disabled={isRegistering}
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-grove-500 text-white hover:bg-grove-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm"
        >
          {#if isRegistering}
            <Loader2 size={16} class="animate-spin" />
            Adding...
          {:else}
            <Plus size={16} />
            Add Passkey
          {/if}
        </button>
      {/if}
    </div>

    <!-- Passkey List -->
    {#if passkeys.length === 0}
      <div class="p-8 text-center bg-grove-50/50 dark:bg-gray-800/50 rounded-lg">
        <div class="w-16 h-16 bg-grove-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <KeyRound size={32} class="text-grove-600 dark:text-grove-400" />
        </div>
        <h3 class="font-serif text-bark dark:text-gray-100 mb-2">No passkeys yet</h3>
        <p class="text-sm text-bark/60 dark:text-gray-400 font-sans mb-4 max-w-sm mx-auto">
          Passkeys let you sign in with biometrics instead of typing passwords. They're faster and more secure.
        </p>
        {#if supportsPasskeys}
          <button
            onclick={handleRegisterPasskey}
            disabled={isRegistering}
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-grove-500 text-white hover:bg-grove-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans"
          >
            {#if isRegistering}
              <Loader2 size={18} class="animate-spin" />
              Adding...
            {:else}
              <Plus size={18} />
              Add Your First Passkey
            {/if}
          </button>
        {:else}
          <p class="text-sm text-amber-600 dark:text-amber-400 font-sans">
            Your browser or device doesn't support passkeys.
          </p>
        {/if}
      </div>
    {:else}
      <div class="space-y-3">
        {#each passkeys as passkey (passkey.id)}
          {@const DeviceIcon = getDeviceIcon(passkey.name, passkey.deviceType)}
          <div class="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-grove-50/50 dark:bg-gray-700/50 rounded-lg">
            <!-- Device Icon & Info -->
            <div class="flex items-start gap-4 flex-1">
              <div class="p-3 rounded-lg bg-grove-100 dark:bg-gray-600">
                <DeviceIcon size={24} class="text-grove-600 dark:text-grove-400" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-serif text-bark dark:text-gray-100">
                  {passkey.name || 'Unnamed Passkey'}
                </h3>
                <div class="mt-1 space-y-0.5">
                  <p class="text-sm text-bark/60 dark:text-gray-400 font-sans">
                    Added: {formatDate(passkey.createdAt)}
                  </p>
                  {#if passkey.deviceType === 'multiDevice'}
                    <p class="text-xs text-grove-600 dark:text-grove-400 font-sans">
                      Synced passkey (backed up)
                    </p>
                  {:else if passkey.deviceType === 'singleDevice'}
                    <p class="text-xs text-amber-600 dark:text-amber-400 font-sans">
                      Device-bound passkey
                    </p>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Delete Button -->
            <form
              method="POST"
              action="?/deletePasskey"
              use:enhance={() => {
                deletingPasskey = passkey.id;
                return async ({ update }) => {
                  await update();
                  deletingPasskey = null;
                };
              }}
            >
              <input type="hidden" name="passkeyId" value={passkey.id} />
              <button
                type="submit"
                disabled={deletingPasskey === passkey.id}
                class="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm"
              >
                <Trash2 size={16} />
                {deletingPasskey === passkey.id ? 'Removing...' : 'Remove'}
              </button>
            </form>
          </div>
        {/each}
      </div>

      <!-- Add another passkey -->
      {#if supportsPasskeys}
        <div class="mt-4 pt-4 border-t border-grove-200 dark:border-gray-600">
          <button
            onclick={handleRegisterPasskey}
            disabled={isRegistering}
            class="flex items-center gap-2 text-sm text-grove-600 dark:text-grove-400 hover:text-grove-700 dark:hover:text-grove-300 transition-colors disabled:opacity-50 font-sans"
          >
            {#if isRegistering}
              <Loader2 size={16} class="animate-spin" />
              Adding...
            {:else}
              <Plus size={16} />
              Add another passkey
            {/if}
          </button>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Passkey Info Box -->
  <div class="p-4 rounded-lg bg-grove-50 dark:bg-gray-800/50 border border-grove-200 dark:border-gray-700">
    <h3 class="font-serif text-bark dark:text-gray-100 mb-2">About Passkeys</h3>
    <ul class="text-sm text-bark/60 dark:text-gray-400 font-sans space-y-1">
      <li>Passkeys use biometrics (Face ID, Touch ID, Windows Hello) or security keys</li>
      <li>They're phishing-resistant and can't be stolen or reused</li>
      <li>"Synced" passkeys are backed up to your cloud account (iCloud, Google, etc.)</li>
      <li>Add passkeys on multiple devices for backup access</li>
    </ul>
  </div>
</main>
