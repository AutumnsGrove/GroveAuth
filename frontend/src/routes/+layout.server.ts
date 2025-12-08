/**
 * Root Layout Server - Session checking and subdomain detection
 */

import type { LayoutServerLoad } from './$types';
import { AUTH_API_URL } from '$lib/config';

export interface SessionData {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    is_admin: boolean;
  };
  client?: {
    id: string;
    name: string;
    domain: string | null;
  };
  last_used_client_id?: string | null;
}

export const load: LayoutServerLoad = async ({ locals, cookies, fetch }) => {
  const subdomain = locals.subdomain;

  // Check session status from backend via session cookie
  const sessionCookie = cookies.get('session');
  let sessionData: SessionData = { authenticated: false };

  if (sessionCookie) {
    try {
      const response = await fetch(`${AUTH_API_URL}/session/check`, {
        headers: {
          Cookie: `session=${sessionCookie}`,
        },
      });

      if (response.ok) {
        sessionData = await response.json();
      }
    } catch (e) {
      // Session check failed, continue without session
      console.error('Session check failed:', e);
    }
  }

  return {
    subdomain,
    session: sessionData,
  };
};
