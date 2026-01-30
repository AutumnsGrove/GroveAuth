<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  import { LoginGraft } from '@autumnsgrove/groveengine/grafts/login';
  import { Glass, GlassCard, seasonStore } from '@autumnsgrove/groveengine/ui';
  import { Fingerprint, ShieldCheck, Globe, ArrowRight } from 'lucide-svelte';

  let { data } = $props();

  // Use $derived for reactive values from data
  let isAdmin = $derived(data?.subdomain === 'admin');
  let isLogin = $derived(data?.subdomain === 'login');
  let needsLogin = $derived(data?.needsLogin);
  let error = $derived(data?.error);
  let errorDescription = $derived(data?.errorDescription);

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
</script>

<svelte:head>
  {#if isAdmin}
    <title>Admin Dashboard - Heartwood</title>
  {:else}
    <title>Heartwood — Secure Authentication</title>
  {/if}
  <meta name="description" content="Heartwood is the centralized authentication service for AutumnsGrove properties. Secure, passwordless login with passkeys or Google." />
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
  <main class="min-h-screen flex flex-col items-center justify-center px-6 py-16 transition-colors duration-1000 {seasonalBg()}">
    <Glass variant="tint" class="p-8 max-w-md rounded-2xl text-center">
      <div class="mb-6">
        <Logo size="lg" />
      </div>

      <h1 class="text-3xl font-serif text-bark dark:text-gray-100 mb-3">Something went wrong</h1>

      <p class="text-red-500 dark:text-red-400 font-sans mb-2">{error}</p>
      <p class="text-bark/60 dark:text-gray-400 font-sans text-sm">{errorDescription}</p>

      <a
        href="/"
        class="inline-flex items-center gap-2 mt-6 bg-grove-600 hover:bg-grove-700 text-white font-sans font-medium px-6 py-2.5 rounded-lg transition-colors duration-200"
      >
        Back to Home
      </a>
    </Glass>
  </main>

{:else}
  <!-- Normal Landing Page -->
  <main class="min-h-screen flex flex-col items-center justify-center px-6 py-16 transition-colors duration-1000 {seasonalBg()}">
    <!-- Hero Section -->
    <Glass variant="tint" class="max-w-2xl w-full p-8 md:p-12 rounded-2xl text-center mb-12">
      <!-- Logo/Brand -->
      <div class="mb-6">
        <Logo size="lg" />
      </div>

      <!-- Title -->
      <h1 class="text-4xl md:text-5xl font-serif text-bark dark:text-gray-100 mb-3">Heartwood</h1>

      <!-- Tagline -->
      <p class="text-xl md:text-2xl text-bark/70 dark:text-gray-300 font-serif italic mb-6">
        The authentic core of Grove authentication
      </p>

      <!-- Description -->
      <p class="text-bark/70 dark:text-gray-300 font-sans leading-relaxed mb-8 max-w-lg mx-auto">
        Secure, passwordless authentication for the Grove ecosystem.
        Sign in with your passkey or Google account—no passwords to remember.
      </p>

      <!-- CTA -->
      <a
        href="/login"
        class="inline-flex items-center gap-2 bg-grove-600 hover:bg-grove-700 text-white font-sans font-medium px-8 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-grove-500 focus:ring-offset-2"
      >
        Sign In
        <ArrowRight class="w-4 h-4" />
      </a>
    </Glass>

    <!-- Features -->
    <div class="grid md:grid-cols-3 gap-6 max-w-4xl w-full px-4">
      <GlassCard class="p-6 text-center" hoverable>
        <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-grove-100 dark:bg-grove-900/30 flex items-center justify-center">
          <Fingerprint class="w-6 h-6 text-grove-600 dark:text-grove-400" />
        </div>
        <h3 class="font-serif text-bark dark:text-gray-100 mb-2">Passkeys First</h3>
        <p class="text-bark/60 dark:text-gray-400 font-sans text-sm leading-relaxed">
          Phishing-resistant authentication using your device's built-in security. No passwords, no codes—just you.
        </p>
      </GlassCard>

      <GlassCard class="p-6 text-center" hoverable>
        <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-grove-100 dark:bg-grove-900/30 flex items-center justify-center">
          <ShieldCheck class="w-6 h-6 text-grove-600 dark:text-grove-400" />
        </div>
        <h3 class="font-serif text-bark dark:text-gray-100 mb-2">Secure by Design</h3>
        <p class="text-bark/60 dark:text-gray-400 font-sans text-sm leading-relaxed">
          Built on modern standards with OAuth 2.0, PKCE, and secure token handling. Your identity, protected.
        </p>
      </GlassCard>

      <GlassCard class="p-6 text-center" hoverable>
        <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-grove-100 dark:bg-grove-900/30 flex items-center justify-center">
          <Globe class="w-6 h-6 text-grove-600 dark:text-grove-400" />
        </div>
        <h3 class="font-serif text-bark dark:text-gray-100 mb-2">One Identity</h3>
        <p class="text-bark/60 dark:text-gray-400 font-sans text-sm leading-relaxed">
          Sign in once and access the entire Grove ecosystem. Fast, reliable, and always available at the edge.
        </p>
      </GlassCard>
    </div>

    <!-- Footer -->
    <footer class="mt-16 text-center">
      <Glass variant="muted" class="inline-flex items-center gap-4 px-6 py-3 rounded-full text-sm font-sans text-bark/60 dark:text-gray-400">
        <a href="https://grove.place" class="hover:text-grove-600 dark:hover:text-grove-400 transition-colors">
          Grove
        </a>
        <span class="text-grove-300 dark:text-gray-600">·</span>
        <span>Part of the AutumnsGrove ecosystem</span>
      </Glass>
    </footer>
  </main>
{/if}
