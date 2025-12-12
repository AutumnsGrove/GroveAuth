<script lang="ts">
  import { AUTH_API_URL } from '$lib/config';
  import Logo from '$lib/components/Logo.svelte';
  import GoogleIcon from '$lib/components/GoogleIcon.svelte';
  import GitHubIcon from '$lib/components/GitHubIcon.svelte';
  import MailIcon from '$lib/components/MailIcon.svelte';

  let { data } = $props();

  // State for magic code flow
  let view = $state<'providers' | 'email' | 'code'>('providers');
  let email = $state('');
  let code = $state('');
  let isLoading = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // Build OAuth URL
  function buildOAuthUrl(provider: string): string {
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

  // Send magic code
  async function sendMagicCode() {
    if (!email || !data.params) return;

    isLoading = true;
    errorMessage = '';

    try {
      const response = await fetch(`${AUTH_API_URL}/magic/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          client_id: data.params.client_id,
          redirect_uri: data.params.redirect_uri
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        view = 'code';
        successMessage = 'Check your email for a 6-digit code';
      } else if (response.status === 429) {
        errorMessage = result.message || 'Too many requests. Please wait before trying again.';
      } else {
        // Always show success to prevent email enumeration
        view = 'code';
        successMessage = 'If this email is registered, a code has been sent';
      }
    } catch {
      errorMessage = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  // Verify magic code
  async function verifyMagicCode() {
    if (!code || !data.params) return;

    isLoading = true;
    errorMessage = '';

    try {
      const response = await fetch(`${AUTH_API_URL}/magic/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          client_id: data.params.client_id,
          redirect_uri: data.params.redirect_uri,
          state: data.params.state
        })
      });

      const result = await response.json();

      if (response.ok && result.redirect_uri) {
        window.location.href = result.redirect_uri;
      } else if (response.status === 423) {
        errorMessage = result.message || 'Account temporarily locked. Please try again later.';
      } else {
        errorMessage = result.message || 'Invalid or expired code';
        code = '';
      }
    } catch {
      errorMessage = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  // Handle code input formatting
  function handleCodeInput(e: Event) {
    const input = e.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 6);
    code = input.value;
  }
</script>

<svelte:head>
  <title>Sign In — Heartwood</title>
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

    {#if !data.params}
      <!-- Error: Missing params -->
      <div class="alert alert-error mt-4">
        <p class="font-medium">Invalid Request</p>
        <p class="text-sm mt-1">{data.errorDescription || 'Missing required parameters'}</p>
      </div>
      <a href="/" class="btn-secondary w-full mt-6 text-center block">
        Back to Home
      </a>
    {:else}
      <p class="text-bark/60 dark:text-gray-400 font-sans text-center mb-6">
        {#if view === 'providers'}
          Choose how you'd like to sign in
        {:else if view === 'email'}
          Enter your email to receive a code
        {:else}
          Enter the code sent to {email}
        {/if}
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

      <!-- Success message -->
      {#if successMessage && view === 'code'}
        <div class="alert alert-success mb-4">
          <p class="text-sm">{successMessage}</p>
        </div>
      {/if}

      <!-- Provider Selection View -->
      {#if view === 'providers'}
        <div class="space-y-3">
          <a href={buildOAuthUrl('google')} class="btn-provider">
            <GoogleIcon />
            Continue with Google
          </a>

          <a href={buildOAuthUrl('github')} class="btn-provider">
            <GitHubIcon />
            Continue with GitHub
          </a>
        </div>

        <div class="divider">
          <span>or</span>
        </div>

        <button
          type="button"
          onclick={() => { view = 'email'; errorMessage = ''; }}
          class="btn-primary w-full flex items-center justify-center gap-2"
        >
          <MailIcon />
          Sign in with Email
        </button>
      {/if}

      <!-- Email Entry View -->
      {#if view === 'email'}
        <form onsubmit={(e) => { e.preventDefault(); sendMagicCode(); }}>
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
            {isLoading ? 'Sending...' : 'Send Code'}
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

      <!-- Code Entry View -->
      {#if view === 'code'}
        <form onsubmit={(e) => { e.preventDefault(); verifyMagicCode(); }}>
          <div class="mb-4">
            <label for="code" class="block text-sm font-sans font-medium text-bark dark:text-gray-200 mb-2">
              Enter 6-digit code
            </label>
            <input
              type="text"
              id="code"
              value={code}
              oninput={handleCodeInput}
              placeholder="000000"
              class="input-code"
              maxlength="6"
              required
              disabled={isLoading}
              autocomplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            class="btn-primary w-full mb-4"
            disabled={isLoading || code.length !== 6}
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>

          <div class="flex flex-col gap-2 text-center">
            <button
              type="button"
              onclick={() => { sendMagicCode(); }}
              class="text-sm text-bark/60 dark:text-gray-400 hover:text-grove-600 dark:hover:text-grove-400 font-sans transition-colors"
              disabled={isLoading}
            >
              Resend code
            </button>
            <button
              type="button"
              onclick={() => { view = 'email'; code = ''; errorMessage = ''; successMessage = ''; }}
              class="text-sm text-bark/60 dark:text-gray-400 hover:text-grove-600 dark:hover:text-grove-400 font-sans transition-colors"
            >
              Use a different email
            </button>
          </div>
        </form>
      {/if}
    {/if}
  </div>

  <!-- Footer -->
  <p class="mt-8 text-sm text-bark/50 dark:text-gray-500 font-sans">
    Powered by <a href="https://heartwood.grove.place" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">Heartwood</a>
  </p>
</main>
