/**
 * Security Settings - Server-side data fetching
 * Lists user's passkeys and provides delete actions
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
    // Fetch passkeys via Better Auth API
    const cookieHeader = groveSession
      ? `grove_session=${groveSession}`
      : `access_token=${accessToken}`;

    const response = await fetch(`${AUTH_API_URL}/api/auth/passkey/list-user-passkeys`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw redirect(303, '/');
      }
      // Return empty list if passkeys not available
      return {
        passkeys: [],
        user: session.user,
      };
    }

    const passkeys = await response.json();

    return {
      passkeys: passkeys || [],
      user: session.user,
    };
  } catch (e) {
    if (e instanceof Response || (e as any)?.status) {
      throw e;
    }
    console.error('Security page load error:', e);
    return {
      passkeys: [],
      user: session.user,
      error: 'Failed to load passkeys',
    };
  }
};

export const actions: Actions = {
  /**
   * Delete a passkey
   */
  deletePasskey: async ({ request, cookies }) => {
    const formData = await request.formData();
    const passkeyId = formData.get('passkeyId') as string;

    if (!passkeyId) {
      return fail(400, { error: 'Passkey ID required' });
    }

    const groveSession = cookies.get('grove_session');
    if (!groveSession) {
      return fail(401, { error: 'Not authenticated' });
    }

    try {
      const response = await fetch(`${AUTH_API_URL}/api/auth/passkey/delete-passkey`, {
        method: 'POST',
        headers: {
          Cookie: `grove_session=${groveSession}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: passkeyId }),
      });

      if (!response.ok) {
        const data = await response.json();
        return fail(response.status, { error: data.message || 'Failed to delete passkey' });
      }

      return { success: true, message: 'Passkey removed' };
    } catch (e) {
      console.error('Delete passkey error:', e);
      return fail(500, { error: 'Failed to delete passkey' });
    }
  },
};
