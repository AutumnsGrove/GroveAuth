# GroveAuth Integration Guide

> How to add GroveAuth authentication to your site

---

## Overview

GroveAuth is a centralized authentication service for AutumnsGrove properties. Instead of implementing auth yourself, redirect users to GroveAuth and receive verified JWT tokens back.

**Auth URL**: `https://auth.grove.place`

---

## Quick Start

### 1. Get Your Client Credentials

Contact the GroveAuth admin to register your site. You'll receive:
- `client_id` - Public identifier for your app
- `client_secret` - Secret key (keep this secure, server-side only)

Your redirect URIs must be pre-registered (e.g., `https://yoursite.com/auth/callback`).

---

### 2. Add Login Button

Redirect users to GroveAuth with required parameters:

```typescript
// Generate PKCE values (required for security)
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
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

// Login function
async function login() {
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store these in session/cookie for callback
  sessionStorage.setItem('auth_state', state);
  sessionStorage.setItem('code_verifier', codeVerifier);

  const params = new URLSearchParams({
    client_id: 'your-client-id',
    redirect_uri: 'https://yoursite.com/auth/callback',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  window.location.href = `https://auth.grove.place/login?${params}`;
}
```

---

### 3. Handle the Callback

After authentication, GroveAuth redirects back with an authorization code:

```
https://yoursite.com/auth/callback?code=abc123&state=xyz789
```

Exchange this code for tokens:

```typescript
// Server-side callback handler
async function handleAuthCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Check for errors
  if (error) {
    return new Response(`Auth failed: ${error}`, { status: 400 });
  }

  // Verify state matches (get from cookie/session)
  const savedState = getCookie(request, 'auth_state');
  if (state !== savedState) {
    return new Response('Invalid state', { status: 400 });
  }

  // Get code verifier from session
  const codeVerifier = getCookie(request, 'code_verifier');

  // Exchange code for tokens
  const tokenResponse = await fetch('https://auth.grove.place/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: 'https://yoursite.com/auth/callback',
      client_id: 'your-client-id',
      client_secret: env.GROVEAUTH_CLIENT_SECRET,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.json();
    return new Response(`Token exchange failed: ${err.error}`, { status: 400 });
  }

  const tokens = await tokenResponse.json();
  // tokens = { access_token, refresh_token, expires_in, token_type }

  // Create your local session
  return createSession(tokens);
}
```

---

### 4. Verify Tokens on Protected Routes

```typescript
async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  const response = await fetch('https://auth.grove.place/verify', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!result.active) {
    return null;
  }

  return {
    id: result.sub,
    email: result.email,
    name: result.name,
  };
}
```

---

### 5. Refresh Tokens

Access tokens expire after 1 hour. Use the refresh token to get new ones:

```typescript
async function refreshAccessToken(refreshToken: string, env: Env) {
  const response = await fetch('https://auth.grove.place/token/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'your-client-id',
      client_secret: env.GROVEAUTH_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    // Refresh token expired or revoked - user needs to login again
    return null;
  }

  return response.json();
  // Returns new access_token and refresh_token
}
```

---

### 6. Logout

```typescript
async function logout(accessToken: string) {
  await fetch('https://auth.grove.place/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // Clear your local session
  clearSession();
}
```

---

## API Reference

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/login` | Login page (redirect users here) |
| POST | `/token` | Exchange auth code for tokens |
| POST | `/token/refresh` | Refresh access token |
| POST | `/token/revoke` | Revoke a refresh token |
| GET | `/verify` | Verify access token validity |
| GET | `/userinfo` | Get current user info |
| POST | `/logout` | Logout and revoke all tokens |
| GET | `/health` | Health check |

### Token Response

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "scope": "openid email profile"
}
```

### Verify Response

```json
{
  "active": true,
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "exp": 1705312800,
  "iat": 1705309200,
  "client_id": "your-client-id"
}
```

### UserInfo Response

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "provider": "google"
}
```

---

## SvelteKit Integration

For SvelteKit apps, here's a complete integration pattern:

### `src/lib/auth.ts`

```typescript
import { env } from '$env/dynamic/private';

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
  picture: string | null;
}

export function getLoginUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: env.GROVEAUTH_CLIENT_ID,
    redirect_uri: env.GROVEAUTH_REDIRECT_URI,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_BASE_URL}/login?${params}`;
}

export async function exchangeCode(
  code: string,
  codeVerifier: string
): Promise<AuthTokens> {
  const response = await fetch(`${AUTH_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.GROVEAUTH_REDIRECT_URI,
      client_id: env.GROVEAUTH_CLIENT_ID,
      client_secret: env.GROVEAUTH_CLIENT_SECRET,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  return response.json();
}

export async function verifyToken(accessToken: string): Promise<AuthUser | null> {
  const response = await fetch(`${AUTH_BASE_URL}/verify`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const result = await response.json();
  if (!result.active) return null;

  return {
    sub: result.sub,
    email: result.email,
    name: result.name || null,
    picture: null,
  };
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
  const response = await fetch(`${AUTH_BASE_URL}/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.GROVEAUTH_CLIENT_ID,
      client_secret: env.GROVEAUTH_CLIENT_SECRET,
    }),
  });

  if (!response.ok) return null;
  return response.json();
}
```

### `src/hooks.server.ts`

```typescript
import type { Handle } from '@sveltejs/kit';
import { verifyToken, refreshTokens } from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const accessToken = event.cookies.get('access_token');
  const refreshToken = event.cookies.get('refresh_token');

  if (accessToken) {
    const user = await verifyToken(accessToken);
    if (user) {
      event.locals.user = user;
    } else if (refreshToken) {
      // Try to refresh
      const tokens = await refreshTokens(refreshToken);
      if (tokens) {
        event.cookies.set('access_token', tokens.access_token, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: tokens.expires_in,
        });
        event.cookies.set('refresh_token', tokens.refresh_token, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60, // 30 days
        });
        event.locals.user = await verifyToken(tokens.access_token);
      }
    }
  }

  return resolve(event);
};
```

---

## Environment Variables

Add these to your `.env` or Cloudflare secrets:

```bash
GROVEAUTH_CLIENT_ID=your-client-id
GROVEAUTH_CLIENT_SECRET=your-client-secret
GROVEAUTH_REDIRECT_URI=https://yoursite.com/auth/callback
```

---

## Security Best Practices

1. **Always use PKCE** - Required for all OAuth flows
2. **Store client_secret server-side only** - Never expose to browser
3. **Validate state parameter** - Prevents CSRF attacks
4. **Use httpOnly cookies** - For storing tokens
5. **Implement token refresh** - Don't let users get logged out unexpectedly
6. **Handle errors gracefully** - Check for error params in callback

---

## Troubleshooting

### "Invalid state" error
- Make sure you're storing and retrieving the state from the same session
- State is single-use; don't reuse it

### "Invalid redirect_uri"
- Your redirect URI must exactly match what's registered for your client
- Check for trailing slashes, http vs https

### "Invalid code verifier"
- PKCE verifier must be the same one used to generate the challenge
- Verifier is 43-128 characters, base64url encoded

### Token expired
- Access tokens last 1 hour
- Use the refresh token to get new tokens
- Refresh tokens last 30 days

---

*For questions or to register a new client, contact the GroveAuth admin.*
