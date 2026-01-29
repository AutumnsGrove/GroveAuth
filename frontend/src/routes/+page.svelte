<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { LoginGraft } from '@autumnsgrove/groveengine/grafts/login';
  import { Circle, ShieldCheck, Key, Zap } from 'lucide-svelte';

  let { data } = $props();

  // Use $derived for reactive values from data
  let isAdmin = $derived(data?.subdomain === 'admin');
  let isLogin = $derived(data?.subdomain === 'login');
  let needsLogin = $derived(data?.needsLogin);
  let error = $derived(data?.error);
  let errorDescription = $derived(data?.errorDescription);
</script>

<svelte:head>
  {#if isAdmin}
    <title>Admin Dashboard - Heartwood</title>
  {:else}
    <title>Heartwood — Secure Authentication</title>
  {/if}
  <meta name="description" content="Heartwood is the centralized authentication service for AutumnsGrove properties. Secure login with Google, GitHub, or email magic codes." />
</svelte:head>

{#if isAdmin && needsLogin}
  <!-- Admin Login Required - Uses LoginGraft from GroveEngine -->
  <main class="min-h-screen flex flex-col items-center justify-center px-6 py-16">
    <LoginGraft
      variant="fullpage"
      providers={['google']}
      returnTo="/dashboard"
      loginUrl="/auth/login"
    >
      {#snippet logo()}
        <Logo size="lg" />
      {/snippet}
      {#snippet header()}
        <h1 class="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
        <p class="mt-2 text-sm text-muted-foreground">Sign in to access administration</p>
      {/snippet}
      {#snippet footer()}
        <p class="text-xs text-muted-foreground">Admin access is restricted to authorized users only.</p>
      {/snippet}
    </LoginGraft>

    <footer class="mt-16 text-center">
      <div class="flex items-center justify-center gap-4 text-sm font-sans text-bark/50 dark:text-gray-500">
        <a href="https://heartwood.grove.place" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">
          Heartwood Home
        </a>
      </div>
    </footer>
  </main>

{:else if error}
  <!-- Error State -->
  <main class="min-h-screen flex flex-col items-center justify-center px-6 py-16">
    <div class="mb-6">
      <Logo size="lg" />
    </div>

    <h1 class="text-3xl font-serif text-bark dark:text-gray-100 mb-3 text-center">Error</h1>

    <div class="card p-8 max-w-md text-center">
      <p class="text-red-400 font-sans mb-2">{error}</p>
      <p class="text-bark/60 dark:text-gray-400 font-sans text-sm">{errorDescription}</p>

      <a
        href="https://heartwood.grove.place"
        class="inline-block mt-6 px-6 py-2 border border-grove-400 text-bark dark:text-gray-200 font-sans rounded-lg hover:bg-grove-50 dark:hover:bg-gray-700 transition-colors"
      >
        Back to Home
      </a>
    </div>
  </main>

{:else}
  <!-- Normal Landing Page -->
  <main class="min-h-screen flex flex-col items-center justify-center px-6 py-16">
    <!-- Logo/Brand -->
    <div class="mb-6">
      <Logo size="lg" />
    </div>

    <!-- Title -->
    <h1 class="text-4xl md:text-5xl font-serif text-bark dark:text-gray-100 mb-3 text-center">Heartwood</h1>

  <!-- Tagline -->
  <p class="text-xl md:text-2xl text-bark/70 dark:text-gray-400 font-serif italic mb-8 text-center">
    The authentic core of Grove authentication
  </p>

  <!-- Decorative divider -->
  <div class="flex items-center gap-4 mb-8">
    <div class="w-12 h-px bg-grove-300 dark:bg-gray-600"></div>
    <Circle size={16} class="text-grove-400 fill-current" />
    <div class="w-12 h-px bg-grove-300 dark:bg-gray-600"></div>
  </div>

  <!-- Description -->
  <div class="max-w-xl text-center mb-12 space-y-4">
    <p class="text-bark/70 dark:text-gray-300 font-sans leading-relaxed">
      Heartwood provides secure, centralized authentication for all AutumnsGrove properties.
      Sign in once and access the entire ecosystem with a single identity.
    </p>
    <p class="text-bark/60 dark:text-gray-400 font-sans text-sm">
      Supports Google, GitHub, and magic code authentication with secure JWT tokens.
    </p>
  </div>

  <!-- Features -->
  <div class="grid md:grid-cols-3 gap-6 max-w-3xl mb-12">
    <div class="card p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-4 text-grove-600 dark:text-grove-400">
        <ShieldCheck size={48} strokeWidth={1.5} />
      </div>
      <h3 class="font-serif text-bark dark:text-gray-100 mb-2">Secure by Default</h3>
      <p class="text-bark/60 dark:text-gray-400 font-sans text-sm">
        OAuth 2.0 with PKCE, secure token handling, and allowlist-based access control
      </p>
    </div>

    <div class="card p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-4 text-grove-600 dark:text-grove-400">
        <Key size={48} strokeWidth={1.5} />
      </div>
      <h3 class="font-serif text-bark dark:text-gray-100 mb-2">Multiple Providers</h3>
      <p class="text-bark/60 dark:text-gray-400 font-sans text-sm">
        Sign in with Google, GitHub, or passwordless email magic codes
      </p>
    </div>

    <div class="card p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-4 text-grove-600 dark:text-grove-400">
        <Zap size={48} strokeWidth={1.5} />
      </div>
      <h3 class="font-serif text-bark dark:text-gray-100 mb-2">Fast & Reliable</h3>
      <p class="text-bark/60 dark:text-gray-400 font-sans text-sm">
        Built on Cloudflare Workers for global edge performance
      </p>
    </div>
  </div>

  <!-- CTA -->
  <div class="text-center">
    <p class="text-bark/50 dark:text-gray-500 font-sans text-sm">
      This is the authentication service. Looking to sign in?
    </p>
    <p class="text-bark/60 dark:text-gray-400 font-sans text-sm mt-1">
      Visit your application and click "Sign In" to be redirected here.
    </p>
  </div>

  <!-- Footer -->
  <footer class="mt-16 text-center">
    <div class="flex items-center justify-center gap-4 text-sm font-sans text-bark/50 dark:text-gray-500">
      <a href="https://grove.place" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">
        Grove
      </a>
      <span class="text-grove-300 dark:text-gray-600">·</span>
      <span>Part of the AutumnsGrove ecosystem</span>
    </div>
  </footer>
  </main>
{/if}
