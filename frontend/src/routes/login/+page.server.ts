import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { AUTH_API_URL } from '$lib/config';

export interface LoginParams {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

export const load: PageServerLoad = async ({ url }) => {
  const client_id = url.searchParams.get('client_id');
  const redirect_uri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');
  const code_challenge = url.searchParams.get('code_challenge');
  const code_challenge_method = url.searchParams.get('code_challenge_method');
  const provider = url.searchParams.get('provider');

  const error = url.searchParams.get('error');
  const error_description = url.searchParams.get('error_description');

  // If missing required params, show an error
  if (!client_id || !redirect_uri || !state) {
    return {
      params: null,
      error: 'invalid_request',
      errorDescription: 'Missing required parameters (client_id, redirect_uri, state)'
    };
  }

  // Auto-redirect to provider if specified (skip the login UI)
  // This enables LoginGraft's direct-to-provider flow
  if (provider === 'google') {
    const oauthParams = new URLSearchParams({
      client_id,
      redirect_uri,
      state
    });
    if (code_challenge) {
      oauthParams.set('code_challenge', code_challenge);
      oauthParams.set('code_challenge_method', code_challenge_method || 'S256');
    }
    redirect(302, `${AUTH_API_URL}/oauth/google?${oauthParams.toString()}`);
  }

  const params: LoginParams = {
    client_id,
    redirect_uri,
    state
  };

  if (code_challenge) {
    params.code_challenge = code_challenge;
    params.code_challenge_method = code_challenge_method || 'S256';
  }

  return {
    params,
    error: error || null,
    errorDescription: error_description || null
  };
};
