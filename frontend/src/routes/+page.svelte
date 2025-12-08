<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
</script>

<svelte:head>
  <title>GroveAuth — Secure Authentication</title>
  <meta name="description" content="Centralized authentication service for AutumnsGrove properties. Secure login with Google, GitHub, or email magic codes." />
</svelte:head>

<main class="min-h-screen flex flex-col items-center justify-center px-6 py-16">
  <!-- Logo/Brand -->
  <div class="mb-6">
    <Logo size="lg" />
  </div>

  <!-- Title -->
  <h1 class="text-4xl md:text-5xl font-serif text-bark mb-3 text-center">GroveAuth</h1>

  <!-- Tagline -->
  <p class="text-xl md:text-2xl text-bark/70 font-serif italic mb-8 text-center">
    Secure authentication for the Grove ecosystem
  </p>

  <!-- Decorative divider -->
  <div class="flex items-center gap-4 mb-8">
    <div class="w-12 h-px bg-grove-300"></div>
    <svg class="w-4 h-4 text-grove-400" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="10" cy="10" r="4" />
    </svg>
    <div class="w-12 h-px bg-grove-300"></div>
  </div>

  <!-- Description -->
  <div class="max-w-xl text-center mb-12 space-y-4">
    <p class="text-bark/70 font-sans leading-relaxed">
      GroveAuth provides secure, centralized authentication for all AutumnsGrove properties.
      Sign in once and access the entire ecosystem with a single identity.
    </p>
    <p class="text-bark/60 font-sans text-sm">
      Supports Google, GitHub, and magic code authentication with secure JWT tokens.
    </p>
  </div>

  <!-- Features -->
  <div class="grid md:grid-cols-3 gap-6 max-w-3xl mb-12">
    <div class="card p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-4 text-grove-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-full h-full">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <h3 class="font-serif text-bark mb-2">Secure by Default</h3>
      <p class="text-bark/60 font-sans text-sm">
        OAuth 2.0 with PKCE, secure token handling, and allowlist-based access control
      </p>
    </div>

    <div class="card p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-4 text-grove-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-full h-full">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      </div>
      <h3 class="font-serif text-bark mb-2">Multiple Providers</h3>
      <p class="text-bark/60 font-sans text-sm">
        Sign in with Google, GitHub, or passwordless email magic codes
      </p>
    </div>

    <div class="card p-6 text-center">
      <div class="w-12 h-12 mx-auto mb-4 text-grove-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-full h-full">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      </div>
      <h3 class="font-serif text-bark mb-2">Fast & Reliable</h3>
      <p class="text-bark/60 font-sans text-sm">
        Built on Cloudflare Workers for global edge performance
      </p>
    </div>
  </div>

  <!-- CTA -->
  <div class="text-center">
    <p class="text-bark/50 font-sans text-sm">
      This is the authentication service. Looking to sign in?
    </p>
    <p class="text-bark/60 font-sans text-sm mt-1">
      Visit your application and click "Sign In" to be redirected here.
    </p>
  </div>

  <!-- Footer -->
  <footer class="mt-16 text-center">
    <div class="flex items-center justify-center gap-4 text-sm font-sans text-bark/50">
      <a href="https://grove.place" class="hover:text-grove-600 transition-colors">
        Grove
      </a>
      <span class="text-grove-300">·</span>
      <span>Part of the AutumnsGrove ecosystem</span>
    </div>
  </footer>
</main>
