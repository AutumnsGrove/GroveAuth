/**
 * Login Route - Provider selection page for Better Auth
 *
 * This is a minimal login page that triggers Better Auth sign-in flows.
 * It maintains backwards compatibility with legacy OAuth parameters while
 * using Better Auth under the hood.
 *
 * Supports:
 * - Legacy OAuth params (client_id, redirect_uri, state, code_challenge)
 * - Simple returnTo param for redirects (device flow, etc.)
 * - All Better Auth providers (Google, Discord, Magic Link, Passkeys)
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';

const login = new Hono<{ Bindings: Env }>();

/**
 * GET /login - Display login page with provider selection
 *
 * Query params:
 * - returnTo: Simple redirect after login (for device flow, etc.)
 * - redirect_uri: Legacy OAuth redirect URI
 * - state: Legacy OAuth state (encoded in returnTo if redirect_uri provided)
 * - provider: Optional - skip to specific provider (google, discord)
 */
login.get('/', async (c) => {
  // Get redirect destination
  // Priority: returnTo > redirect_uri with state > default
  let callbackURL = c.req.query('returnTo');

  if (!callbackURL) {
    const redirectUri = c.req.query('redirect_uri');
    const state = c.req.query('state');
    if (redirectUri) {
      // Build callback URL that preserves state for legacy OAuth clients
      const url = new URL(redirectUri);
      if (state) {
        url.searchParams.set('state', state);
      }
      callbackURL = url.toString();
    }
  }

  // If provider is specified, redirect directly to that provider
  const provider = c.req.query('provider');
  if (provider && (provider === 'google' || provider === 'discord')) {
    const signInUrl = new URL(`${c.env.AUTH_BASE_URL}/api/auth/sign-in/social`);
    signInUrl.searchParams.set('provider', provider);
    if (callbackURL) {
      signInUrl.searchParams.set('callbackURL', callbackURL);
    }
    return c.redirect(signInUrl.toString());
  }

  // Render login page
  const html = getLoginPageHTML(c.env.AUTH_BASE_URL, callbackURL);
  return c.html(html);
});

/**
 * Generate the login page HTML
 */
function getLoginPageHTML(authBaseUrl: string, callbackURL?: string): string {
  const callbackParam = callbackURL ? `&callbackURL=${encodeURIComponent(callbackURL)}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Heartwood</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1f16 0%, #2d3a24 50%, #1a1f16 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .login-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .logo {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo h1 {
      font-size: 28px;
      font-weight: 600;
      color: #1a1f16;
      margin-bottom: 8px;
    }

    .logo p {
      color: #6b7280;
      font-size: 14px;
    }

    .providers {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .provider-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 14px 20px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: white;
      color: #374151;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .provider-btn:hover {
      background: #f9fafb;
      border-color: #d1d5db;
      transform: translateY(-1px);
    }

    .provider-btn svg {
      width: 20px;
      height: 20px;
    }

    .provider-btn.google:hover {
      border-color: #4285f4;
      background: #f8faff;
    }

    .provider-btn.discord:hover {
      border-color: #5865f2;
      background: #f8f9ff;
    }

    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      color: #9ca3af;
      font-size: 13px;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }

    .divider span {
      padding: 0 16px;
    }

    .magic-link-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .magic-link-form input {
      padding: 14px 16px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }

    .magic-link-form input:focus {
      border-color: #4b5e3d;
    }

    .magic-link-form button {
      padding: 14px 20px;
      background: #4b5e3d;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .magic-link-form button:hover {
      background: #3d4d32;
    }

    .footer {
      text-align: center;
      margin-top: 24px;
      color: #9ca3af;
      font-size: 12px;
    }

    .footer a {
      color: #4b5e3d;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="logo">
      <h1>Heartwood</h1>
      <p>Sign in to continue</p>
    </div>

    <div class="providers">
      <a href="${authBaseUrl}/api/auth/sign-in/social?provider=google${callbackParam}" class="provider-btn google">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </a>

      <a href="${authBaseUrl}/api/auth/sign-in/social?provider=discord${callbackParam}" class="provider-btn discord">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        Continue with Discord
      </a>
    </div>

    <div class="divider"><span>or</span></div>

    <form class="magic-link-form" action="${authBaseUrl}/api/auth/sign-in/magic-link" method="POST">
      <input type="hidden" name="callbackURL" value="${callbackURL || `${authBaseUrl}/login`}">
      <input type="email" name="email" placeholder="Enter your email" required>
      <button type="submit">Send magic link</button>
    </form>

    <div class="footer">
      <p>Heartwood authentication for <a href="https://grove.place">Grove</a></p>
    </div>
  </div>
</body>
</html>`;
}

export default login;
