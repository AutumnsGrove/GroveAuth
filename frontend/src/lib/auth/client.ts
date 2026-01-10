/**
 * Better Auth Client for Heartwood Frontend
 *
 * This client provides authentication methods using Better Auth.
 * It replaces the legacy magic code flow with magic links.
 *
 * Usage:
 * ```typescript
 * import { auth, signInWithGoogle, signInWithMagicLink } from '$lib/auth/client';
 *
 * // Sign in with Google
 * await signInWithGoogle({ callbackURL: '/dashboard' });
 *
 * // Sign in with magic link
 * await signInWithMagicLink('user@example.com', { callbackURL: '/dashboard' });
 *
 * // Get current session
 * const session = await auth.getSession();
 * ```
 */

import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { AUTH_API_URL } from '$lib/config';

/**
 * Better Auth client instance
 */
export const auth = createAuthClient({
  baseURL: AUTH_API_URL,
  plugins: [magicLinkClient(), passkeyClient()],
});

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(options?: {
  callbackURL?: string;
  errorCallbackURL?: string;
}) {
  return auth.signIn.social({
    provider: 'google',
    callbackURL: options?.callbackURL || '/',
    errorCallbackURL: options?.errorCallbackURL || '/login?error=oauth_failed',
  });
}

/**
 * Sign in with magic link (email)
 * Sends a magic link to the user's email
 */
export async function signInWithMagicLink(
  email: string,
  options?: {
    callbackURL?: string;
    name?: string;
  }
) {
  return auth.signIn.magicLink({
    email,
    callbackURL: options?.callbackURL || '/dashboard',
    name: options?.name,
  });
}

/**
 * Sign in with passkey (WebAuthn)
 */
export async function signInWithPasskey() {
  return auth.signIn.passkey();
}

/**
 * Register a new passkey for the current user
 */
export async function registerPasskey(name?: string) {
  return auth.passkey.addPasskey({ name });
}

/**
 * Get the current session
 */
export async function getSession() {
  return auth.getSession();
}

/**
 * Get the current user
 */
export async function getUser() {
  const session = await auth.getSession();
  return session.data?.user || null;
}

/**
 * Check if the user is authenticated
 */
export async function isAuthenticated() {
  const session = await auth.getSession();
  return !!session.data?.session;
}

/**
 * Sign out
 */
export async function signOut() {
  return auth.signOut();
}

/**
 * List all passkeys for the current user
 */
export async function listPasskeys() {
  return auth.passkey.listUserPasskeys();
}

/**
 * Delete a passkey
 */
export async function deletePasskey(id: string) {
  return auth.passkey.deletePasskey({ id });
}

// Re-export types
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;

export default auth;
