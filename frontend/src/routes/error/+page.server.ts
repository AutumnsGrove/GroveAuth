import type { PageServerLoad } from './$types';

/**
 * Error Page
 * Displays authentication errors with user-friendly messages
 */
export const load: PageServerLoad = async ({ url }) => {
  const error = url.searchParams.get('error') || 'unknown_error';
  const error_description = url.searchParams.get('error_description');

  // Map common errors to user-friendly messages
  const errorMessages: Record<string, string> = {
    access_denied: 'You denied the authentication request',
    invalid_request: 'The authentication request was invalid',
    invalid_client: 'The application is not recognized',
    invalid_grant: 'The authorization code has expired or is invalid',
    unauthorized_client: 'This application is not authorized',
    unsupported_response_type: 'The response type is not supported',
    invalid_scope: 'The requested permissions are invalid',
    server_error: 'The authentication server encountered an error',
    temporarily_unavailable: 'The authentication service is temporarily unavailable',
    email_not_allowed: 'Your email is not on the allowlist',
    rate_limited: 'Too many attempts. Please try again later.',
    unknown_error: 'An unexpected error occurred'
  };

  return {
    error,
    errorDescription: error_description || errorMessages[error] || errorMessages.unknown_error
  };
};
