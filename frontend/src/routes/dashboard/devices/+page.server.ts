/**
 * Device Management - Server-side data fetching and actions
 * Lists all active sessions and allows revoking them
 */

import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { AUTH_API_URL } from '$lib/config';

export const load: PageServerLoad = async ({ parent, cookies }) => {
  const { session } = await parent();

  // Must be logged in
  if (!session.authenticated) {
    throw redirect(303, '/');
  }

  // Get cookies for session validation
  const groveSession = cookies.get('grove_session');
  const accessToken = cookies.get('access_token');

  if (!groveSession && !accessToken) {
    throw redirect(303, '/');
  }

  try {
    // Fetch active sessions
    const cookieHeader = groveSession
      ? `grove_session=${groveSession}`
      : `access_token=${accessToken}`;

    const response = await fetch(`${AUTH_API_URL}/session/list`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw redirect(303, '/');
      }
      throw new Error('Failed to fetch sessions');
    }

    const data = await response.json();

    return {
      sessions: data.sessions || [],
      user: session.user,
    };
  } catch (e) {
    if (e instanceof Response || (e as any)?.status) {
      throw e;
    }
    console.error('Devices load error:', e);
    return {
      sessions: [],
      user: session.user,
      error: 'Failed to load sessions',
    };
  }
};

export const actions: Actions = {
  /**
   * Revoke a specific session
   */
  revoke: async ({ request, cookies }) => {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;

    if (!sessionId) {
      return fail(400, { error: 'Session ID required' });
    }

    const groveSession = cookies.get('grove_session');
    if (!groveSession) {
      return fail(401, { error: 'Not authenticated' });
    }

    try {
      const response = await fetch(`${AUTH_API_URL}/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Cookie: `grove_session=${groveSession}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        return fail(response.status, { error: data.error || 'Failed to revoke session' });
      }

      return { success: true, message: 'Session revoked' };
    } catch (e) {
      console.error('Revoke session error:', e);
      return fail(500, { error: 'Failed to revoke session' });
    }
  },

  /**
   * Revoke all other sessions (keep current)
   */
  revokeAll: async ({ cookies }) => {
    const groveSession = cookies.get('grove_session');
    if (!groveSession) {
      return fail(401, { error: 'Not authenticated' });
    }

    try {
      const response = await fetch(`${AUTH_API_URL}/session/revoke-all`, {
        method: 'POST',
        headers: {
          Cookie: `grove_session=${groveSession}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keepCurrent: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        return fail(response.status, { error: data.error || 'Failed to revoke sessions' });
      }

      const data = await response.json();
      return { success: true, message: `Revoked ${data.revokedCount} sessions` };
    } catch (e) {
      console.error('Revoke all sessions error:', e);
      return fail(500, { error: 'Failed to revoke sessions' });
    }
  },
};
