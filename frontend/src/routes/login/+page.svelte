<script lang="ts">
  import { AUTH_API_URL, FRONTEND_URL } from '$lib/config';
  import {
    signInWithGoogle,
    signInWithPasskey,
    auth,
  } from '$lib/auth/client';
  import Logo from '$lib/components/Logo.svelte';
  import GoogleIcon from '$lib/components/GoogleIcon.svelte';
  import { Glass, seasonStore } from '@autumnsgrove/groveengine/ui';
  import { Fingerprint, Loader2 } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let { data } = $props();

  // State for auth flow
  let isLoading = $state(false);
  let loadingProvider = $state<'passkey' | 'google' | null>(null);
  let errorMessage = $state('');

  // Passkey support detection
  let supportsPasskeys = $state(false);

  // Determine callback URL from params or default
  // Use absolute URL to ensure redirect goes to frontend, not API domain
  let callbackURL = $derived(data.params?.redirect_uri || `${FRONTEND_URL}/dashboard`);
  let errorCallbackURL = $derived(
    data.params
      ? `/login?error=auth_failed&client_id=${encodeURIComponent(data.params.client_id || '')}&redirect_uri=${encodeURIComponent(data.params.redirect_uri || '')}&state=${encodeURIComponent(data.params.state || '')}`
      : '/login?error=auth_failed'
  );

  // Check if we're in legacy OAuth flow (with client_id params)
  let isLegacyFlow = $derived(!!data.params?.client_id);

  // Seasonal background classes
  let season = $derived(seasonStore.current);
  let seasonalBg = $derived(() => {
    switch (season) {
      case 'winter':
        return 'bg-gradient-to-b from-slate-200 via-slate-100 to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700';
      case 'autumn':
        return 'bg-gradient-to-b from-orange-100 via-amber-50 to-yellow-50 dark:from-slate-900 dark:via-amber-950 dark:to-orange-950';
      case 'spring':
        return 'bg-gradient-to-b from-pink-50 via-sky-50 to-lime-50 dark:from-slate-900 dark:via-pink-950 dark:to-lime-950';
      default: // summer
        return 'bg-gradient-to-b from-sky-100 via-emerald-50 to-grove-50 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950';
    }
  });

  // Check device capability and enable Conditional UI on mount
  onMount(async () => {
    // Check if already logged in - if so, redirect to destination
    try {
      const session = await auth.getSession();
      if (session.data?.session) {
        console.log('[Login] Already authenticated, redirecting to:', callbackURL);
        window.location.href = callbackURL;
        return;
      }
    } catch (e) {
      // Not logged in, continue with login UI
      console.log('[Login] No existing session');
    }

    // Check if device supports passkeys
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      try {
        supportsPasskeys = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? false;

        // Enable Conditional UI (autofill) if supported
        if (supportsPasskeys && PublicKeyCredential.isConditionalMediationAvailable) {
          const conditionalSupported = await PublicKeyCredential.isConditionalMediationAvailable();
          if (conditionalSupported) {
            // Start conditional UI - browser will show passkey option in autofill
            auth.signIn.passkey({ autoFill: true }).catch(() => {
              // Silently ignore - conditional UI may fail if no passkeys registered
            });
          }
        }
      } catch {
        supportsPasskeys = false;
      }
    }
  });

  // Build legacy OAuth URL for backwards compatibility
  function buildLegacyOAuthUrl(provider: string): string {
    if (!data.params) return '#';

    const searchParams = new URLSearchParams({
      client_id: data.params.client_id,
      redirect_uri: data.params.redirect_uri,
      state: data.params.state
    });

    if (data.params.code_challenge) {
      searchParams.set('code_challenge', data.params.code_challenge);
      searchParams.set('code_challenge_method', data.params.code_challenge_method || 'S256');
    }

    return `${AUTH_API_URL}/oauth/${provider}?${searchParams.toString()}`;
  }

  // Handle passkey sign in
  async function handlePasskeySignIn() {
    isLoading = true;
    loadingProvider = 'passkey';
    errorMessage = '';
    try {
      const result = await signInWithPasskey();
      if (result.error) {
        errorMessage = result.error.message || 'Passkey sign in failed. Please try another method.';
      }
      // On success, Better Auth will handle the redirect
    } catch (error) {
      errorMessage = 'Passkey sign in failed. Please try another method.';
      console.error('Passkey sign in error:', error);
    } finally {
      isLoading = false;
      loadingProvider = null;
    }
  }

  // Handle Google sign in
  async function handleGoogleSignIn(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('[Login] Google button clicked');
    
    if (isLegacyFlow) {
      console.log('[Login] Using legacy OAuth flow');
      window.location.href = buildLegacyOAuthUrl('google');
      return;
    }

    isLoading = true;
    loadingProvider = 'google';
    errorMessage = '';
    
    try {
      console.log('[Login] Calling signInWithGoogle with callbackURL:', callbackURL);
      const result = await signInWithGoogle({ callbackURL, errorCallbackURL });
      console.log('[Login] signInWithGoogle returned:', result);
      
      // If result has an error, display it
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        throw new Error(result.error.message || 'Unknown error');
      }
      // On success, Better Auth handles the redirect - we should not reach here
      console.log('[Login] signInWithGoogle completed without redirect');
    } catch (error) {
      console.error('[Login] Google sign in error:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to sign in with Google. Please try again.';
      isLoading = false;
      loadingProvider = null;
    }
  }
</script>

<svelte:head>
  <title>Sign In - Heartwood</title>
  <meta name="description" content="Sign in to your AutumnsGrove account via Heartwood" />
</svelte:head>

<main class="min-h-screen flex flex-col items-center justify-center px-6 py-12 transition-colors duration-1000 {seasonalBg()}">
  <!-- Logo -->
  <div class="mb-8">
    <a href="/" class="text-grove-600 hover:text-grove-700 transition-colors" aria-label="Heartwood Home">
      <Logo size="md" />
    </a>
  </div>

  <!-- Card -->
  <Glass variant="card" class="w-full max-w-sm p-8 rounded-2xl">
    <h1 class="text-2xl font-serif text-bark dark:text-gray-100 mb-2 text-center">Welcome back</h1>

    <p class="text-bark/60 dark:text-gray-400 font-sans text-center mb-6">
      Sign in to continue to Grove
    </p>

    <!-- Error from OAuth callback -->
    {#if data.error}
      <div class="alert alert-error mb-4">
        <p class="font-medium">{data.error}</p>
        {#if data.errorDescription}
          <p class="text-sm mt-1">{data.errorDescription}</p>
        {/if}
      </div>
    {/if}

    <!-- Error message -->
    {#if errorMessage}
      <div class="alert alert-error mb-4">
        <p class="text-sm">{errorMessage}</p>
      </div>
    {/if}

    <!-- Auth Buttons -->
    <div class="space-y-3">
      <!-- Passkey (Primary) - Only shown if device supports it -->
      {#if supportsPasskeys}
        <button
          type="button"
          onclick={handlePasskeySignIn}
          class="w-full flex items-center justify-center gap-3 px-6 py-3.5
            bg-grove-600 hover:bg-grove-700 text-white rounded-xl font-sans font-medium
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-grove-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {#if loadingProvider === 'passkey'}
            <Loader2 class="w-5 h-5 animate-spin" />
            Signing in...
          {:else}
            <Fingerprint class="w-5 h-5" />
            Sign in with Passkey
          {/if}
        </button>

        <div class="flex items-center my-4">
          <div class="flex-1 h-px bg-grove-200 dark:bg-gray-600"></div>
          <span class="px-4 text-bark/50 dark:text-gray-500 text-sm font-sans">or</span>
          <div class="flex-1 h-px bg-grove-200 dark:bg-gray-600"></div>
        </div>
      {/if}

      <!-- Google (Fallback) -->
      <button
        type="button"
        onclick={handleGoogleSignIn}
        class="w-full flex items-center justify-center gap-3 px-6 py-3.5
          bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
          border border-grove-200 dark:border-gray-600 rounded-xl font-sans font-medium
          text-bark dark:text-gray-100 hover:bg-white dark:hover:bg-slate-700
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-grove-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isLoading}
      >
        {#if loadingProvider === 'google'}
          <Loader2 class="w-5 h-5 animate-spin" />
          Signing in...
        {:else}
          <GoogleIcon />
          Continue with Google
        {/if}
      </button>
    </div>

    <!-- Help text -->
    <p class="mt-6 text-xs text-bark/50 dark:text-gray-500 text-center font-sans leading-relaxed">
      {#if supportsPasskeys}
        Passkeys are the fastest and most secure way to sign in.
      {:else}
        Sign in with your Google account to continue.
      {/if}
    </p>
  </Glass>

  <!-- Footer -->
  <p class="mt-8 text-sm text-bark/50 dark:text-gray-500 font-sans">
    Powered by <a href="/" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">Heartwood</a>
  </p>
</main>
