/**
 * Heartwood Login Page Template
 * Styled to match Grove ecosystem aesthetic
 */

import type { LoginParams } from '../types.js';

interface LoginPageOptions {
  error?: string;
  errorDescription?: string;
  clientName?: string;
  params?: LoginParams;
  authBaseUrl?: string;
}

export function getLoginPageHTML(options: LoginPageOptions): string {
  const { error, errorDescription, clientName, params, authBaseUrl = '' } = options;

  // Build OAuth URLs with params
  const buildOAuthUrl = (provider: string) => {
    if (!params) return '#';
    const searchParams = new URLSearchParams({
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      state: params.state,
    });
    if (params.code_challenge) {
      searchParams.set('code_challenge', params.code_challenge);
      searchParams.set('code_challenge_method', params.code_challenge_method || 'S256');
    }
    return `/oauth/${provider}?${searchParams.toString()}`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In - Heartwood</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-bg: #fafaf9;
      --color-surface: #ffffff;
      --color-primary: #166534;
      --color-primary-hover: #15803d;
      --color-text: #1c1917;
      --color-text-muted: #78716c;
      --color-border: #e7e5e4;
      --color-error: #dc2626;
      --color-error-bg: #fef2f2;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      --radius: 12px;
      --radius-sm: 8px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --color-bg: #1c1917;
        --color-surface: #292524;
        --color-primary: #4ade80;
        --color-primary-hover: #22c55e;
        --color-text: #fafaf9;
        --color-text-muted: #a8a29e;
        --color-border: #44403c;
        --color-error: #f87171;
        --color-error-bg: #450a0a;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Lexend', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      line-height: 1.5;
    }

    .container {
      width: 100%;
      max-width: 400px;
    }

    .card {
      background: var(--color-surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow-lg);
      padding: 32px;
      border: 1px solid var(--color-border);
    }

    .logo {
      text-align: center;
      margin-bottom: 24px;
    }

    .logo h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .logo svg {
      width: 32px;
      height: 32px;
    }

    .subtitle {
      text-align: center;
      color: var(--color-text-muted);
      margin-bottom: 24px;
      font-size: 14px;
    }

    .client-name {
      font-weight: 600;
      color: var(--color-text);
    }

    .error-box {
      background: var(--color-error-bg);
      border: 1px solid var(--color-error);
      border-radius: var(--radius-sm);
      padding: 16px;
      margin-bottom: 24px;
    }

    .error-box h3 {
      color: var(--color-error);
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .error-box p {
      color: var(--color-error);
      font-size: 13px;
      opacity: 0.9;
    }

    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-border);
    }

    .divider span {
      padding: 0 12px;
    }

    .providers {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      border-radius: var(--radius-sm);
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
    }

    .btn:hover {
      background: var(--color-bg);
      border-color: var(--color-text-muted);
    }

    .btn svg {
      width: 20px;
      height: 20px;
    }

    .btn-primary {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }

    .btn-primary:hover {
      background: var(--color-primary-hover);
      border-color: var(--color-primary-hover);
    }

    .magic-form {
      margin-top: 24px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--color-text);
    }

    .form-group input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 15px;
      background: var(--color-surface);
      color: var(--color-text);
      transition: border-color 0.15s ease;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    .form-group input::placeholder {
      color: var(--color-text-muted);
    }

    .code-input {
      text-align: center;
      font-size: 24px !important;
      letter-spacing: 8px;
      font-family: monospace;
    }

    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .footer a {
      color: var(--color-primary);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    .hidden {
      display: none;
    }

    .loading {
      opacity: 0.7;
      pointer-events: none;
    }

    .message {
      text-align: center;
      padding: 16px;
      border-radius: var(--radius-sm);
      margin-bottom: 16px;
      font-size: 14px;
    }

    .message-success {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    @media (prefers-color-scheme: dark) {
      .message-success {
        background: #14532d;
        color: #bbf7d0;
        border-color: #166534;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          Heartwood
        </h1>
      </div>

      ${error ? `
      <div class="error-box">
        <h3>${escapeHtml(error)}</h3>
        ${errorDescription ? `<p>${escapeHtml(errorDescription)}</p>` : ''}
      </div>
      ` : ''}

      ${params ? `
      <p class="subtitle">
        Sign in to continue to <span class="client-name">${escapeHtml(clientName || 'the application')}</span>
      </p>

      <div id="provider-view">
        <div class="providers">
          <a href="${buildOAuthUrl('google')}" class="btn">
            <svg viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>

          <a href="${buildOAuthUrl('discord')}" class="btn" style="background: #5865F2; color: white; border-color: #5865F2;">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Continue with Discord
          </a>

          <button id="passkey-signin" class="btn" type="button" style="display: none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 11c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
              <path d="M19 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
              <path d="M19 14v4"/>
              <path d="M17 18h4"/>
              <path d="M1 18c0-3.31 2.69-6 6-6h2"/>
            </svg>
            Sign in with Passkey
          </button>
        </div>

        <div class="divider"><span>or</span></div>

        <button id="show-magic" class="btn btn-primary" type="button">
          Sign in with Email
        </button>
      </div>

      <div id="magic-view" class="hidden">
        <div id="email-form">
          <form id="magic-email-form" class="magic-form">
            <div class="form-group">
              <label for="email">Email address</label>
              <input type="email" id="email" name="email" placeholder="you@example.com" required>
            </div>
            <button type="submit" class="btn btn-primary">Send code</button>
          </form>
        </div>

        <div id="code-form" class="hidden">
          <div id="code-message" class="message message-success">
            Check your email for a 6-digit code
          </div>
          <form id="magic-code-form" class="magic-form">
            <div class="form-group">
              <label for="code">Enter code</label>
              <input type="text" id="code" name="code" class="code-input" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required>
            </div>
            <button type="submit" class="btn btn-primary">Verify</button>
          </form>
        </div>

        <div class="divider"><span>or</span></div>

        <button id="back-to-providers" class="btn" type="button">
          Back to sign in options
        </button>
      </div>
      ` : ''}

      <p class="footer">
        Powered by <a href="https://heartwood.grove.place" target="_blank">Heartwood</a>
      </p>
    </div>
  </div>

  ${params ? `
  <script>
    const params = ${JSON.stringify({
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      state: params.state,
    })};

    const API_BASE = '${authBaseUrl}';

    // View switching
    const providerView = document.getElementById('provider-view');
    const magicView = document.getElementById('magic-view');
    const showMagicBtn = document.getElementById('show-magic');
    const backBtn = document.getElementById('back-to-providers');
    const emailForm = document.getElementById('email-form');
    const codeForm = document.getElementById('code-form');

    // Passkey support detection and sign-in
    const passkeyBtn = document.getElementById('passkey-signin');

    async function checkPasskeySupport() {
      if (window.PublicKeyCredential) {
        try {
          // Check if conditional UI (autofill) is available
          const available = await PublicKeyCredential.isConditionalMediationAvailable?.() ||
                           await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
          if (available) {
            passkeyBtn.style.display = 'flex';
          }
        } catch (e) {
          // WebAuthn available but no platform authenticator
          passkeyBtn.style.display = 'flex';
        }
      }
    }
    checkPasskeySupport();

    passkeyBtn.addEventListener('click', async () => {
      passkeyBtn.classList.add('loading');
      passkeyBtn.textContent = 'Authenticating...';

      try {
        // Call Better Auth passkey sign-in endpoint
        const response = await fetch(API_BASE + '/api/auth/sign-in/passkey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        const data = await response.json();

        if (data.options) {
          // We need to perform the WebAuthn ceremony
          const credential = await navigator.credentials.get({
            publicKey: {
              ...data.options,
              challenge: base64ToArrayBuffer(data.options.challenge),
              allowCredentials: data.options.allowCredentials?.map(cred => ({
                ...cred,
                id: base64ToArrayBuffer(cred.id),
              })),
            },
          });

          // Send the credential back to complete sign-in
          const verifyResponse = await fetch(API_BASE + '/api/auth/sign-in/passkey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              credential: {
                id: credential.id,
                rawId: arrayBufferToBase64(credential.rawId),
                type: credential.type,
                response: {
                  clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
                  authenticatorData: arrayBufferToBase64(credential.response.authenticatorData),
                  signature: arrayBufferToBase64(credential.response.signature),
                  userHandle: credential.response.userHandle ? arrayBufferToBase64(credential.response.userHandle) : null,
                },
              },
            }),
          });

          const verifyData = await verifyResponse.json();

          if (verifyResponse.ok && verifyData.user) {
            // Success - redirect to the callback
            window.location.href = params.redirect_uri + '?state=' + encodeURIComponent(params.state);
          } else {
            throw new Error(verifyData.message || 'Passkey verification failed');
          }
        } else if (response.ok && data.user) {
          // Already signed in
          window.location.href = params.redirect_uri + '?state=' + encodeURIComponent(params.state);
        } else {
          throw new Error(data.message || 'Failed to sign in with passkey');
        }
      } catch (err) {
        console.error('Passkey error:', err);
        alert(err.name === 'NotAllowedError' ? 'Passkey authentication was cancelled.' :
              err.message || 'Failed to sign in with passkey. Please try another method.');
        passkeyBtn.classList.remove('loading');
        passkeyBtn.innerHTML = \`
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 11c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
            <path d="M19 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
            <path d="M19 14v4"/>
            <path d="M17 18h4"/>
            <path d="M1 18c0-3.31 2.69-6 6-6h2"/>
          </svg>
          Sign in with Passkey
        \`;
      }
    });

    // Base64 utility functions for WebAuthn
    function base64ToArrayBuffer(base64) {
      const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }

    function arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
    }

    showMagicBtn.addEventListener('click', () => {
      providerView.classList.add('hidden');
      magicView.classList.remove('hidden');
    });

    backBtn.addEventListener('click', () => {
      magicView.classList.add('hidden');
      providerView.classList.remove('hidden');
      emailForm.classList.remove('hidden');
      codeForm.classList.add('hidden');
    });

    // Magic code email form
    let userEmail = '';
    document.getElementById('magic-email-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.classList.add('loading');

      userEmail = document.getElementById('email').value;

      try {
        const res = await fetch('/magic/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            client_id: params.client_id,
            redirect_uri: params.redirect_uri,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          emailForm.classList.add('hidden');
          codeForm.classList.remove('hidden');
          document.getElementById('code').focus();
        } else {
          alert(data.message || 'Failed to send code');
        }
      } catch (err) {
        alert('Network error. Please try again.');
      } finally {
        form.classList.remove('loading');
      }
    });

    // Magic code verify form
    document.getElementById('magic-code-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      form.classList.add('loading');

      const code = document.getElementById('code').value;

      try {
        const res = await fetch('/magic/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            code: code,
            client_id: params.client_id,
            redirect_uri: params.redirect_uri,
            state: params.state,
          }),
        });

        const data = await res.json();

        if (res.ok && data.redirect_uri) {
          window.location.href = data.redirect_uri;
        } else {
          alert(data.message || 'Invalid code');
          document.getElementById('code').value = '';
          document.getElementById('code').focus();
        }
      } catch (err) {
        alert('Network error. Please try again.');
      } finally {
        form.classList.remove('loading');
      }
    });

    // Auto-format code input
    document.getElementById('code').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    });
  </script>
  ` : ''}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
