<script lang="ts">
  import { AUTH_API_URL } from '$lib/config';
  import {
    signInWithGoogle,
    signInWithGitHub,
    signInWithMagicLink,
    signInWithPasskey,
  } from '$lib/auth/client';
  import Logo from '$lib/components/Logo.svelte';
  import GoogleIcon from '$lib/components/GoogleIcon.svelte';
  import GitHubIcon from '$lib/components/GitHubIcon.svelte';
  import MailIcon from '$lib/components/MailIcon.svelte';
  import { KeyRound } from 'lucide-svelte';

  let { data } = $props();

  // State for auth flow
  let view = $state<'providers' | 'email' | 'sent'>('providers');
  let email = $state('');
  let isLoading = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // Determine callback URL from params or default
  const callbackURL = data.params?.redirect_uri || '/dashboard';
  const errorCallbackURL = `/login?error=auth_failed&${new URLSearchParams(data.params || {}).toString()}`;

  // Check if we're in legacy OAuth flow (with client_id params)
  const isLegacyFlow = !!data.params?.client_id;

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

  // Handle Google sign in
  async function handleGoogleSignIn() {
    if (isLegacyFlow) {
      // Use legacy OAuth flow for existing clients
      window.location.href = buildLegacyOAuthUrl('google');
      return;
    }

    isLoading = true;
    errorMessage = '';
    try {
      await signInWithGoogle({ callbackURL, errorCallbackURL });
    } catch (error) {
      errorMessage = 'Failed to sign in with Google. Please try again.';
      console.error('Google sign in error:', error);
      isLoading = false;
    }
  }

  // Handle GitHub sign in
  async function handleGitHubSignIn() {
    if (isLegacyFlow) {
      // Use legacy OAuth flow for existing clients
      window.location.href = buildLegacyOAuthUrl('github');
      return;
    }

    isLoading = true;
    errorMessage = '';
    try {
      await signInWithGitHub({ callbackURL, errorCallbackURL });
    } catch (error) {
      errorMessage = 'Failed to sign in with GitHub. Please try again.';
      console.error('GitHub sign in error:', error);
      isLoading = false;
    }
  }

  // Send magic link
  async function sendMagicLink() {
    if (!email) return;

    isLoading = true;
    errorMessage = '';

    try {
      const result = await signInWithMagicLink(email, { callbackURL });

      if (result.error) {
        // Check for specific errors
        if (result.error.message?.includes('not authorized')) {
          errorMessage = 'This email is not authorized. Contact an administrator for access.';
        } else {
          // Still show success to prevent email enumeration
          view = 'sent';
          successMessage = 'If this email is registered, a magic link has been sent.';
        }
      } else {
        view = 'sent';
        successMessage = 'Check your email for a sign-in link!';
      }
    } catch (error) {
      // Show success message anyway to prevent email enumeration
      view = 'sent';
      successMessage = 'If this email is registered, a magic link has been sent.';
    } finally {
      isLoading = false;
    }
  }

  // Handle passkey sign in
  async function handlePasskeySignIn() {
    isLoading = true;
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
    }
  }
</script>

<svelte:head>
  <title>Sign In - Heartwood</title>
  <meta name="description" content="Sign in to your AutumnsGrove account via Heartwood" />
</svelte:head>

<main class="min-h-screen flex flex-col items-center justify-center px-6 py-12">
  <!-- Logo -->
  <div class="mb-8">
    <a href="/" class="text-grove-600 hover:text-grove-700 transition-colors" aria-label="Heartwood Home">
      <Logo size="md" />
    </a>
  </div>

  <!-- Card -->
  <div class="card-elevated w-full max-w-sm p-8">
    <h1 class="text-2xl font-serif text-bark dark:text-gray-100 mb-2 text-center">Sign In</h1>

    <p class="text-bark/60 dark:text-gray-400 font-sans text-center mb-6">
      {#if view === 'providers'}
        Choose how you'd like to sign in
      {:else if view === 'email'}
        Enter your email to receive a magic link
      {:else}
        Check your inbox
      {/if}
    </p>

    <!-- Error from OAuth callback -->
    {#if data.error && view === 'providers'}
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

    <!-- Success message -->
    {#if successMessage && view === 'sent'}
      <div class="alert alert-success mb-4">
        <p class="text-sm">{successMessage}</p>
      </div>
    {/if}

    <!-- Provider Selection View -->
    {#if view === 'providers'}
      <div class="space-y-3">
        <button
          type="button"
          onclick={handleGoogleSignIn}
          class="btn-provider"
          disabled={isLoading}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <button
          type="button"
          onclick={handleGitHubSignIn}
          class="btn-provider"
          disabled={isLoading}
        >
          <GitHubIcon />
          Continue with GitHub
        </button>

        {#if !isLegacyFlow}
          <button
            type="button"
            onclick={handlePasskeySignIn}
            class="btn-provider"
            disabled={isLoading}
          >
            <KeyRound class="w-5 h-5" />
            Sign in with Passkey
          </button>
        {/if}
      </div>

      <div class="divider">
        <span>or</span>
      </div>

      <button
        type="button"
        onclick={() => { view = 'email'; errorMessage = ''; }}
        class="btn-primary w-full flex items-center justify-center gap-2"
        disabled={isLoading}
      >
        <MailIcon />
        Sign in with Email
      </button>
    {/if}

    <!-- Email Entry View -->
    {#if view === 'email'}
      <form onsubmit={(e) => { e.preventDefault(); sendMagicLink(); }}>
        <div class="mb-4">
          <label for="email" class="block text-sm font-sans font-medium text-bark dark:text-gray-200 mb-2">
            Email address
          </label>
          <input
            type="email"
            id="email"
            bind:value={email}
            placeholder="you@example.com"
            class="input-field"
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          class="btn-primary w-full mb-4"
          disabled={isLoading || !email}
        >
          {isLoading ? 'Sending...' : 'Send Magic Link'}
        </button>

        <button
          type="button"
          onclick={() => { view = 'providers'; email = ''; errorMessage = ''; }}
          class="w-full text-sm text-bark/60 dark:text-gray-400 hover:text-grove-600 dark:hover:text-grove-400 font-sans transition-colors"
        >
          Back to sign in options
        </button>
      </form>
    {/if}

    <!-- Magic Link Sent View -->
    {#if view === 'sent'}
      <div class="text-center">
        <div class="mb-6">
          <div class="w-16 h-16 bg-grove-100 dark:bg-grove-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <MailIcon class="w-8 h-8 text-grove-600 dark:text-grove-400" />
          </div>
          <p class="text-bark dark:text-gray-200 font-medium">
            Magic link sent to
          </p>
          <p class="text-grove-600 dark:text-grove-400 font-mono text-sm mt-1">
            {email}
          </p>
        </div>

        <p class="text-sm text-bark/60 dark:text-gray-400 mb-6">
          Click the link in your email to sign in. The link expires in 10 minutes.
        </p>

        <div class="flex flex-col gap-2">
          <button
            type="button"
            onclick={() => { sendMagicLink(); }}
            class="text-sm text-bark/60 dark:text-gray-400 hover:text-grove-600 dark:hover:text-grove-400 font-sans transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Resend magic link'}
          </button>
          <button
            type="button"
            onclick={() => { view = 'email'; successMessage = ''; }}
            class="text-sm text-bark/60 dark:text-gray-400 hover:text-grove-600 dark:hover:text-grove-400 font-sans transition-colors"
          >
            Use a different email
          </button>
          <button
            type="button"
            onclick={() => { view = 'providers'; email = ''; successMessage = ''; }}
            class="text-sm text-bark/60 dark:text-gray-400 hover:text-grove-600 dark:hover:text-grove-400 font-sans transition-colors"
          >
            Back to sign in options
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <p class="mt-8 text-sm text-bark/50 dark:text-gray-500 font-sans">
    Powered by <a href="https://heartwood.grove.place" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">Heartwood</a>
  </p>
</main>
