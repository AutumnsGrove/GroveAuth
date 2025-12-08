# Migrate Existing Auth to GroveAuth

> **Copy this entire prompt and give it to an agent working on your project**

---

## Task: Migrate Authentication to GroveAuth

This project currently has its own authentication implementation (Google OAuth, magic codes, or similar). I need you to migrate it to use **GroveAuth**, our centralized authentication service.

### What is GroveAuth?

GroveAuth is a centralized auth service at `https://auth.grove.place` that handles:
- Google OAuth
- GitHub OAuth
- Magic Code (email) authentication

Instead of each site implementing auth directly, sites redirect to GroveAuth and receive verified JWT tokens back.

### Your Task

1. **Find existing auth code** - Search for:
   - Google OAuth implementations (look for `accounts.google.com`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
   - Magic code / email auth (look for 6-digit codes, Resend API, email verification)
   - Auth routes like `/login`, `/auth/callback`, `/api/auth/*`
   - Session/cookie management for auth

2. **Remove direct OAuth/auth code** - Delete or replace:
   - Direct Google/GitHub OAuth flows
   - Magic code generation and verification
   - Direct calls to OAuth providers
   - Keep session cookie management but update to use GroveAuth tokens

3. **Implement GroveAuth integration** - Add:
   - GroveAuth utility library (see below)
   - Login route that redirects to GroveAuth
   - Callback route that exchanges code for tokens
   - Logout route
   - Server hooks/middleware for token verification

### Implementation Reference

Read the GroveAuth documentation at:
- `https://github.com/AutumnsGrove/GroveAuth/blob/main/docs/AGENT_INTEGRATION.md`

Or use this implementation:

#### 1. Create `src/lib/auth/groveauth.ts`:

```typescript
const AUTH_BASE_URL = 'https://auth.grove.place';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string | null;
}

// PKCE Helpers
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
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

// Auth Functions
export function getLoginUrl(clientId: string, redirectUri: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
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
  if (!response.ok) throw new Error('Token exchange failed');
  return response.json();
}

export async function verifyToken(accessToken: string): Promise<{ active: boolean; sub?: string; email?: string; name?: string }> {
  const response = await fetch(`${AUTH_BASE_URL}/verify`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
}

export async function refreshTokens(refreshToken: string, clientId: string, clientSecret: string): Promise<AuthTokens | null> {
  const response = await fetch(`${AUTH_BASE_URL}/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
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

#### 2. Create auth routes (SvelteKit example):

**`src/routes/auth/login/+server.ts`:**
```typescript
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { generateCodeVerifier, generateCodeChallenge, getLoginUrl } from '$lib/auth/groveauth';

export const GET = async ({ cookies }) => {
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  cookies.set('auth_state', state, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
  cookies.set('code_verifier', codeVerifier, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });

  throw redirect(302, getLoginUrl(env.GROVEAUTH_CLIENT_ID, env.GROVEAUTH_REDIRECT_URI, state, codeChallenge));
};
```

**`src/routes/auth/callback/+server.ts`:**
```typescript
import { redirect, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { exchangeCode } from '$lib/auth/groveauth';

export const GET = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (url.searchParams.get('error')) throw error(400, 'Auth failed');
  if (state !== cookies.get('auth_state')) throw error(400, 'Invalid state');

  const codeVerifier = cookies.get('code_verifier');
  cookies.delete('auth_state', { path: '/' });
  cookies.delete('code_verifier', { path: '/' });

  const tokens = await exchangeCode({
    code: code!,
    codeVerifier: codeVerifier!,
    clientId: env.GROVEAUTH_CLIENT_ID,
    clientSecret: env.GROVEAUTH_CLIENT_SECRET,
    redirectUri: env.GROVEAUTH_REDIRECT_URI,
  });

  cookies.set('access_token', tokens.access_token, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: tokens.expires_in });
  cookies.set('refresh_token', tokens.refresh_token, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 });

  throw redirect(302, '/admin');
};
```

**`src/routes/auth/logout/+server.ts`:**
```typescript
import { redirect } from '@sveltejs/kit';
import { logout } from '$lib/auth/groveauth';

export const POST = async ({ cookies }) => {
  const token = cookies.get('access_token');
  if (token) await logout(token).catch(() => {});
  cookies.delete('access_token', { path: '/' });
  cookies.delete('refresh_token', { path: '/' });
  throw redirect(302, '/');
};
```

#### 3. Update `src/hooks.server.ts`:

```typescript
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { verifyToken, refreshTokens } from '$lib/auth/groveauth';

export const handle: Handle = async ({ event, resolve }) => {
  const accessToken = event.cookies.get('access_token');
  const refreshToken = event.cookies.get('refresh_token');
  event.locals.user = null;

  if (accessToken) {
    const info = await verifyToken(accessToken);
    if (info.active) {
      event.locals.user = { id: info.sub!, email: info.email!, name: info.name || null };
    } else if (refreshToken) {
      const newTokens = await refreshTokens(refreshToken, env.GROVEAUTH_CLIENT_ID, env.GROVEAUTH_CLIENT_SECRET);
      if (newTokens) {
        event.cookies.set('access_token', newTokens.access_token, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: newTokens.expires_in });
        event.cookies.set('refresh_token', newTokens.refresh_token, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 });
        const newInfo = await verifyToken(newTokens.access_token);
        if (newInfo.active) event.locals.user = { id: newInfo.sub!, email: newInfo.email!, name: newInfo.name || null };
      }
    }
  }

  return resolve(event);
};
```

### Environment Variables Needed

Add these to the project:
```
GROVEAUTH_CLIENT_ID=groveengine
GROVEAUTH_CLIENT_SECRET=<get from admin>
GROVEAUTH_REDIRECT_URI=https://thissite.grove.place/auth/callback
```

### What to Remove

- [ ] Direct Google OAuth code (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, Google token exchange)
- [ ] Direct GitHub OAuth code (if present)
- [ ] Magic code generation/verification (Resend API calls for auth codes)
- [ ] JWT signing code (GroveAuth handles this now)
- [ ] User creation on first login (GroveAuth manages users)

### What to Keep

- [ ] Session cookie handling (but update to use GroveAuth tokens)
- [ ] Protected route checks (but use `locals.user` from GroveAuth)
- [ ] Any user preferences/data stored locally (not auth data)

### Verification Checklist

After migration:
- [ ] `/auth/login` redirects to `auth.grove.place`
- [ ] Can complete full auth flow and return to site
- [ ] `locals.user` is populated on authenticated requests
- [ ] Token refresh works (test by waiting or manually expiring)
- [ ] Logout clears session
- [ ] Protected routes redirect to login when not authenticated
- [ ] Old Google/magic code env vars can be removed

---

**Important**: This site uses the `groveengine` client since it's on `*.grove.place`. The client secret will be provided separately.
