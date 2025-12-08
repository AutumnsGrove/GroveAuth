/**
 * Root Page Server - Handle subdomain-based routing
 *
 * - auth.grove.place: Show landing page
 * - admin.grove.place: Dashboard for admins, redirect non-admins to their client's /admin
 * - login.grove.place: Redirect logged-in users to their client's domain
 */

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ parent }) => {
  const { subdomain, session } = await parent();

  // Handle admin.grove.place
  if (subdomain === 'admin') {
    if (!session.authenticated) {
      // Not logged in - return info for the page to show login prompt
      return {
        needsLogin: true,
        subdomain,
      };
    }

    if (session.user?.is_admin) {
      // Admin user - redirect to dashboard
      throw redirect(303, '/dashboard');
    }

    // Non-admin user - redirect to their client's admin panel
    if (session.client?.domain) {
      throw redirect(303, `https://${session.client.domain}/admin`);
    }

    // No client domain - show error
    return {
      error: 'no_client',
      errorDescription: 'No client domain configured for your account',
      subdomain,
    };
  }

  // Handle login.grove.place
  if (subdomain === 'login') {
    if (session.authenticated && session.client?.domain) {
      // Logged in with a client - redirect to client domain
      throw redirect(303, `https://${session.client.domain}`);
    }
    // Not logged in or no client - show landing page with login info
    return {
      needsLogin: !session.authenticated,
      subdomain,
    };
  }

  // auth.grove.place - just show the landing page
  return {
    subdomain,
  };
};
