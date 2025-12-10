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

  // Debug: pass through the detected hostname info
  const debugHostname = (locals as any).debugHostname;
  const debugHostHeader = (locals as any).debugHostHeader;
  const debugXForwardedHost = (locals as any).debugXForwardedHost;

  // Check session status from backend via cookies
  const sessionCookie = cookies.get('session');
  const accessToken = cookies.get('access_token');
  let sessionData: SessionData = { authenticated: false };

  // Build cookie header with available auth cookies
  const cookieParts: string[] = [];
  if (sessionCookie) cookieParts.push(`session=${sessionCookie}`);
  if (accessToken) cookieParts.push(`access_token=${accessToken}`);

  if (cookieParts.length > 0) {
    try {
      const response = await fetch(`${AUTH_API_URL}/session/check`, {
        headers: {
          Cookie: cookieParts.join('; '),
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
    debugHostname,
    debugHostHeader,
    debugXForwardedHost,
  };
};
