/**
 * Admin Dashboard - Server-side data fetching
 * Only accessible to admin users (autumn@grove.place, autumnbrown23@pm.me)
 */

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { AUTH_API_URL } from '$lib/config';

export const load: PageServerLoad = async ({ parent, cookies }) => {
  const { session } = await parent();

  // Must be logged in
  if (!session.authenticated) {
    throw redirect(303, '/login?return_to=/dashboard');
  }

  // Must be admin
  if (!session.user?.is_admin) {
    throw redirect(303, '/error?error=forbidden&error_description=Admin+access+required');
  }

  // Get access token from cookie to fetch admin stats
  const accessToken = cookies.get('access_token');
  if (!accessToken) {
    // No access token, try to use session to redirect to login
    throw redirect(303, '/login?return_to=/dashboard');
  }

  try {
    // Fetch admin stats
    const statsResponse = await fetch(`${AUTH_API_URL}/admin/stats`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!statsResponse.ok) {
      if (statsResponse.status === 401 || statsResponse.status === 403) {
        throw redirect(303, '/login?return_to=/dashboard');
      }
      throw new Error('Failed to fetch admin stats');
    }

    const stats = await statsResponse.json();

    // Fetch clients list
    const clientsResponse = await fetch(`${AUTH_API_URL}/admin/clients`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const clientsData = clientsResponse.ok ? await clientsResponse.json() : { clients: [] };

    return {
      stats,
      clients: clientsData.clients,
      user: session.user,
    };
  } catch (e) {
    if (e instanceof Response || (e as any)?.status) {
      throw e;
    }
    console.error('Dashboard load error:', e);
    throw redirect(303, '/error?error=api_error&error_description=Failed+to+load+dashboard');
  }
};
