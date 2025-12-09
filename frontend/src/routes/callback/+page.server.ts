import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { AUTH_API_URL } from '$lib/config';

/**
 * OAuth Callback Handler
 *
 * This page handles the OAuth callback from providers.
 * It exchanges the authorization code for tokens server-side,
 * sets cookies, and redirects to the dashboard.
 *
 * Expected query params:
 * - code: Authorization code (success)
 * - state: State parameter for CSRF verification
 * - error: Error code (failure)
 * - error_description: Human-readable error message
 */
export const load: PageServerLoad = async ({ url, cookies, platform }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const error_description = url.searchParams.get('error_description');

  // Handle error from OAuth provider
  if (error) {
    return {
      success: false,
      error,
      errorDescription: error_description || 'Authentication failed'
    };
  }

  // Must have authorization code
  if (!code) {
    return {
      success: false,
      error: 'missing_code',
      errorDescription: 'No authorization code received'
    };
  }

  // Get client secret from environment
  const clientSecret = platform?.env?.GROVEENGINE_CLIENT_SECRET;
  if (!clientSecret) {
    console.error('GROVEENGINE_CLIENT_SECRET not configured');
    return {
      success: false,
      error: 'server_error',
      errorDescription: 'Server configuration error'
    };
  }

  // Exchange authorization code for tokens
  try {
    const response = await fetch(`${AUTH_API_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://admin.grove.place/callback',
        client_id: 'groveengine',
        client_secret: clientSecret
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Token exchange failed:', err);
      return {
        success: false,
        error: err.error || 'token_exchange_failed',
        errorDescription: err.error_description || 'Failed to exchange authorization code'
      };
    }

    const tokens = await response.json();

    // Set access token cookie with cross-subdomain scope
    cookies.set('access_token', tokens.access_token, {
      path: '/',
      domain: '.grove.place',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 3600 // 1 hour
    });

    // Set refresh token cookie if provided
    if (tokens.refresh_token) {
      cookies.set('refresh_token', tokens.refresh_token, {
        path: '/',
        domain: '.grove.place',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 3600 // 30 days
      });
    }

    // Redirect to dashboard
    throw redirect(303, '/dashboard');
  } catch (e) {
    // Re-throw redirects
    if (e instanceof Response || (e as any)?.status === 303) {
      throw e;
    }

    console.error('Token exchange error:', e);
    return {
      success: false,
      error: 'network_error',
      errorDescription: 'Failed to connect to authentication server'
    };
  }
};
