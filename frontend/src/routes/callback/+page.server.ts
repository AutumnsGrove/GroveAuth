import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

/**
 * OAuth Callback Handler
 *
 * This page handles the OAuth callback from providers.
 * The actual token exchange happens on the backend API,
 * this page just displays the result to the user.
 *
 * Expected query params:
 * - code: Authorization code (success)
 * - state: State parameter for CSRF verification
 * - error: Error code (failure)
 * - error_description: Human-readable error message
 */
export const load: PageServerLoad = async ({ url }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const error_description = url.searchParams.get('error_description');

  if (error) {
    return {
      success: false,
      error,
      errorDescription: error_description || 'Authentication failed'
    };
  }

  if (code && state) {
    return {
      success: true,
      code,
      state,
      message: 'Authentication successful! Redirecting...'
    };
  }

  return {
    success: false,
    error: 'invalid_response',
    errorDescription: 'Invalid callback response'
  };
};
