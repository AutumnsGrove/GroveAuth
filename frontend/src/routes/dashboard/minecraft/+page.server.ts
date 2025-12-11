/**
 * Minecraft Admin Dashboard - Server-side data fetching
 * Only accessible to admin users
 */

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { AUTH_API_URL } from '$lib/config';

export const load: PageServerLoad = async ({ parent, cookies }) => {
  const { session } = await parent();

  // Must be logged in
  if (!session.authenticated) {
    throw redirect(303, '/');
  }

  // Must be admin
  if (!session.user?.is_admin) {
    throw redirect(303, '/error?error=forbidden&error_description=Admin+access+required');
  }

  // Get access token from cookie
  const accessToken = cookies.get('access_token');
  if (!accessToken) {
    throw redirect(303, '/');
  }

  try {
    // Fetch Minecraft server status
    const statusResponse = await fetch(`${AUTH_API_URL}/minecraft/status`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let serverStatus = null;
    if (statusResponse.ok) {
      serverStatus = await statusResponse.json();
    }

    // Fetch whitelist
    const whitelistResponse = await fetch(`${AUTH_API_URL}/minecraft/whitelist`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let whitelist: Array<{ username: string; uuid: string; added_at: string }> = [];
    if (whitelistResponse.ok) {
      const whitelistData = await whitelistResponse.json();
      whitelist = whitelistData.whitelist || [];
    }

    // Fetch session history
    const historyResponse = await fetch(`${AUTH_API_URL}/minecraft/history?limit=10`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let history = null;
    if (historyResponse.ok) {
      history = await historyResponse.json();
    }

    return {
      serverStatus,
      whitelist,
      history,
      user: session.user,
      accessToken, // Pass to client for actions
    };
  } catch (e) {
    if (e instanceof Response || (e as any)?.status) {
      throw e;
    }
    console.error('Minecraft dashboard load error:', e);
    // Return empty data instead of erroring - the page will handle it
    return {
      serverStatus: null,
      whitelist: [],
      history: null,
      user: session.user,
      accessToken,
    };
  }
};
