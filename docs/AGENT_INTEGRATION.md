# GroveAuth Agent Integration Guide

> Instructions for AI agents to add GroveAuth authentication to projects

---

## Purpose

This document provides AI coding agents with everything needed to integrate GroveAuth authentication into AutumnsGrove projects. Follow these instructions to add authentication seamlessly.

---

## When to Use This Guide

Use this guide when:
- Adding admin authentication to an AutumnsGrove site
- Protecting routes that require login
- The user mentions "GroveAuth", "auth.grove.place", or asks for authentication

---

## Pre-requisites

Before starting, confirm:
1. The project has a registered client_id with GroveAuth
2. The redirect URI is registered (usually `https://[domain]/auth/callback`)
3. The client_secret is available as an environment variable

**Default clients:**
- `groveengine` - For GroveEngine sites (`*.grove.place`)
- `autumnsgrove` - For AutumnsGrove main site

---

## Integration Steps

### Step 1: Add Environment Variables

Add to the project's environment configuration:

```bash
# .env or wrangler.toml [vars] or platform secrets
GROVEAUTH_CLIENT_ID=groveengine
GROVEAUTH_CLIENT_SECRET=<secret>  # Set via wrangler secret put or platform UI
GROVEAUTH_REDIRECT_URI=https://yoursite.grove.place/auth/callback
```

### Step 2: Create Auth Utilities

Create `src/lib/auth/groveauth.ts`:

```typescript
/**
 * GroveAuth Integration
 * Centralized auth for AutumnsGrove properties
 */

const AUTH_BASE_URL = 'https://auth.grove.place';

// ==================== Types ====================

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: 'google' | 'github' | 'magic_code';
}

export interface TokenInfo {
  active: boolean;
  sub?: string;
  email?: string;
  name?: string;
  exp?: number;
  client_id?: string;
}

// ==================== PKCE Helpers ====================

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ==================== Auth Functions ====================

export function getLoginUrl(config: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state: config.state,
    code_challenge: config.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_BASE_URL}/login?${params}`;
}

export async function exchangeCode(config: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<AuthTokens> {
  const response = await fetch(`${AUTH_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: config.code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: config.codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Token exchange failed');
  }

  return response.json();
}

export async function verifyToken(accessToken: string): Promise<TokenInfo> {
  const response = await fetch(`${AUTH_BASE_URL}/verify`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
}

export async function getUserInfo(accessToken: string): Promise<AuthUser | null> {
  const response = await fetch(`${AUTH_BASE_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  return response.json();
}

export async function refreshTokens(config: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<AuthTokens | null> {
  const response = await fetch(`${AUTH_BASE_URL}/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) return null;
  return response.json();
}

export async function logout(accessToken: string): Promise<void> {
  await fetch(`${AUTH_BASE_URL}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
```

### Step 3: Create Auth Routes

#### For SvelteKit Projects

Create `src/routes/auth/login/+server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { generateCodeVerifier, generateCodeChallenge, getLoginUrl } from '$lib/auth/groveauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store for callback verification
  cookies.set('auth_state', state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });
  cookies.set('code_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  });

  const loginUrl = getLoginUrl({
    clientId: env.GROVEAUTH_CLIENT_ID,
    redirectUri: env.GROVEAUTH_REDIRECT_URI,
    state,
    codeChallenge,
  });

  throw redirect(302, loginUrl);
};
```

Create `src/routes/auth/callback/+server.ts`:

```typescript
import { redirect, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { exchangeCode, verifyToken } from '$lib/auth/groveauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const authError = url.searchParams.get('error');

  if (authError) {
    throw error(400, `Authentication failed: ${authError}`);
  }

  if (!code || !state) {
    throw error(400, 'Missing code or state');
  }

  // Verify state
  const savedState = cookies.get('auth_state');
  if (state !== savedState) {
    throw error(400, 'Invalid state');
  }

  const codeVerifier = cookies.get('code_verifier');
  if (!codeVerifier) {
    throw error(400, 'Missing code verifier');
  }

  // Clear auth cookies
  cookies.delete('auth_state', { path: '/' });
  cookies.delete('code_verifier', { path: '/' });

  try {
    const tokens = await exchangeCode({
      code,
      codeVerifier,
      clientId: env.GROVEAUTH_CLIENT_ID,
      clientSecret: env.GROVEAUTH_CLIENT_SECRET,
      redirectUri: env.GROVEAUTH_REDIRECT_URI,
    });

    // Set token cookies
    cookies.set('access_token', tokens.access_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: tokens.expires_in,
    });

    cookies.set('refresh_token', tokens.refresh_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    throw redirect(302, '/admin'); // Or wherever authenticated users should go
  } catch (err) {
    if (err instanceof Response) throw err; // Re-throw redirects
    throw error(500, 'Authentication failed');
  }
};
```

Create `src/routes/auth/logout/+server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import { logout } from '$lib/auth/groveauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  const accessToken = cookies.get('access_token');

  if (accessToken) {
    await logout(accessToken).catch(() => {}); // Best effort
  }

  cookies.delete('access_token', { path: '/' });
  cookies.delete('refresh_token', { path: '/' });

  throw redirect(302, '/');
};
```

### Step 4: Add Auth Hook

Create or update `src/hooks.server.ts`:

```typescript
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { verifyToken, refreshTokens, getUserInfo } from '$lib/auth/groveauth';

export const handle: Handle = async ({ event, resolve }) => {
  const accessToken = event.cookies.get('access_token');
  const refreshToken = event.cookies.get('refresh_token');

  event.locals.user = null;

  if (accessToken) {
    const tokenInfo = await verifyToken(accessToken);

    if (tokenInfo.active) {
      event.locals.user = {
        id: tokenInfo.sub!,
        email: tokenInfo.email!,
        name: tokenInfo.name || null,
      };
    } else if (refreshToken) {
      // Token expired, try refresh
      const newTokens = await refreshTokens({
        refreshToken,
        clientId: env.GROVEAUTH_CLIENT_ID,
        clientSecret: env.GROVEAUTH_CLIENT_SECRET,
      });

      if (newTokens) {
        event.cookies.set('access_token', newTokens.access_token, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: newTokens.expires_in,
        });
        event.cookies.set('refresh_token', newTokens.refresh_token, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60,
        });

        const newTokenInfo = await verifyToken(newTokens.access_token);
        if (newTokenInfo.active) {
          event.locals.user = {
            id: newTokenInfo.sub!,
            email: newTokenInfo.email!,
            name: newTokenInfo.name || null,
          };
        }
      }
    }
  }

  return resolve(event);
};
```

### Step 5: Add Type Definitions

Update `src/app.d.ts`:

```typescript
declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email: string;
        name: string | null;
      } | null;
    }
  }
}

export {};
```

### Step 6: Protect Routes

For protected pages, add a load function in `+page.server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/auth/login');
  }

  return {
    user: locals.user,
  };
};
```

---

## For Hono/Cloudflare Workers Projects

### Create Auth Middleware

```typescript
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import * as groveauth from './groveauth'; // The utility file from Step 2

interface Env {
  GROVEAUTH_CLIENT_ID: string;
  GROVEAUTH_CLIENT_SECRET: string;
  GROVEAUTH_REDIRECT_URI: string;
}

const auth = new Hono<{ Bindings: Env }>();

// Login route
auth.get('/login', async (c) => {
  const state = crypto.randomUUID();
  const codeVerifier = groveauth.generateCodeVerifier();
  const codeChallenge = await groveauth.generateCodeChallenge(codeVerifier);

  setCookie(c, 'auth_state', state, { httpOnly: true, secure: true, maxAge: 600 });
  setCookie(c, 'code_verifier', codeVerifier, { httpOnly: true, secure: true, maxAge: 600 });

  const loginUrl = groveauth.getLoginUrl({
    clientId: c.env.GROVEAUTH_CLIENT_ID,
    redirectUri: c.env.GROVEAUTH_REDIRECT_URI,
    state,
    codeChallenge,
  });

  return c.redirect(loginUrl);
});

// Callback route
auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.json({ error }, 400);
  }

  const savedState = getCookie(c, 'auth_state');
  const codeVerifier = getCookie(c, 'code_verifier');

  if (state !== savedState || !codeVerifier || !code) {
    return c.json({ error: 'Invalid auth state' }, 400);
  }

  deleteCookie(c, 'auth_state');
  deleteCookie(c, 'code_verifier');

  const tokens = await groveauth.exchangeCode({
    code,
    codeVerifier,
    clientId: c.env.GROVEAUTH_CLIENT_ID,
    clientSecret: c.env.GROVEAUTH_CLIENT_SECRET,
    redirectUri: c.env.GROVEAUTH_REDIRECT_URI,
  });

  setCookie(c, 'access_token', tokens.access_token, {
    httpOnly: true,
    secure: true,
    maxAge: tokens.expires_in,
  });
  setCookie(c, 'refresh_token', tokens.refresh_token, {
    httpOnly: true,
    secure: true,
    maxAge: 30 * 24 * 60 * 60,
  });

  return c.redirect('/admin');
});

// Logout route
auth.post('/logout', async (c) => {
  const accessToken = getCookie(c, 'access_token');
  if (accessToken) {
    await groveauth.logout(accessToken).catch(() => {});
  }
  deleteCookie(c, 'access_token');
  deleteCookie(c, 'refresh_token');
  return c.redirect('/');
});

export default auth;
```

### Auth Middleware for Protected Routes

```typescript
import { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyToken } from './groveauth';

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const accessToken = getCookie(c, 'access_token');

  if (!accessToken) {
    return c.redirect('/auth/login');
  }

  const tokenInfo = await verifyToken(accessToken);

  if (!tokenInfo.active) {
    return c.redirect('/auth/login');
  }

  c.set('user', {
    id: tokenInfo.sub,
    email: tokenInfo.email,
    name: tokenInfo.name,
  });

  return next();
};
```

---

## Checklist for Agents

When adding GroveAuth to a project, verify:

- [ ] Environment variables are configured (`GROVEAUTH_CLIENT_ID`, `GROVEAUTH_CLIENT_SECRET`, `GROVEAUTH_REDIRECT_URI`)
- [ ] Auth utility file created with PKCE helpers
- [ ] Login route generates state + PKCE and redirects to GroveAuth
- [ ] Callback route validates state, exchanges code, sets cookies
- [ ] Logout route clears cookies and calls GroveAuth logout
- [ ] Server hook/middleware verifies tokens and populates user
- [ ] Token refresh is implemented for expired access tokens
- [ ] Protected routes check for authenticated user
- [ ] TypeScript types are updated for `locals.user` or equivalent
- [ ] Cookies use `httpOnly`, `secure`, and `sameSite` flags

---

## Common Patterns

### Check if User is Admin in Components

```svelte
<script>
  import { page } from '$app/stores';
</script>

{#if $page.data.user}
  <p>Logged in as {$page.data.user.email}</p>
  <form method="POST" action="/auth/logout">
    <button type="submit">Logout</button>
  </form>
{:else}
  <a href="/auth/login">Login</a>
{/if}
```

### API Route Protection

```typescript
export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // User is authenticated, proceed with action
};
```

---

## Error Handling

Handle these GroveAuth errors:

| Error | Meaning | Action |
|-------|---------|--------|
| `invalid_client` | Client ID not found | Check GROVEAUTH_CLIENT_ID |
| `invalid_grant` | Code expired/invalid | Redirect to login |
| `access_denied` | User's email not in allowlist | Show access denied message |
| `rate_limit` | Too many requests | Wait and retry |

---

## Testing Integration

After integration, test:

1. Click login → redirects to auth.grove.place
2. Complete auth → redirects back with tokens set
3. Access protected route → works when logged in
4. Access protected route → redirects to login when not authenticated
5. Wait 1+ hour → token refreshes automatically
6. Click logout → clears session, redirects to home

---

*GroveAuth URL: https://auth.grove.place*
*Default client for GroveEngine sites: `groveengine`*
