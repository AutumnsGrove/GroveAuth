import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { AUTH_API_URL } from '$lib/config';

export const load: PageServerLoad = async ({ parent, cookies }) => {
  const { session } = await parent();

  // Auth checks
  if (!session.authenticated) {
    throw redirect(303, '/');
  }
  if (!session.user?.is_admin) {
    throw redirect(303, '/error?error=forbidden');
  }

  const accessToken = cookies.get('access_token');
  if (!accessToken) {
    throw redirect(303, '/');
  }

  try {
    // Fetch data in parallel
    const [incidentsRes, componentsRes, scheduledRes] = await Promise.all([
      fetch(`${AUTH_API_URL}/status/incidents?status=active`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch(`${AUTH_API_URL}/status/components`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch(`${AUTH_API_URL}/status/scheduled`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    if (!incidentsRes.ok) {
      throw redirect(303, '/error?error=api_error');
    }

    const [incidentsData, componentsData, scheduledData] = await Promise.all([
      incidentsRes.json(),
      componentsRes.json(),
      scheduledRes.json(),
    ]);

    return {
      activeIncidents: incidentsData.incidents || [],
      components: componentsData.components || [],
      scheduled: scheduledData.scheduled || [],
    };
  } catch (e) {
    console.error('Status dashboard load error:', e);
    throw redirect(303, '/error?error=api_error');
  }
};

export const actions: Actions = {
  updateComponentStatus: async ({ request, cookies }) => {
    const formData = await request.formData();
    const slug = formData.get('slug') as string;
    const status = formData.get('status') as string;

    const accessToken = cookies.get('access_token');

    try {
      const response = await fetch(`${AUTH_API_URL}/status/components/${slug}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        return fail(response.status, { error: 'Failed to update component status' });
      }

      return { success: true, message: 'Component status updated' };
    } catch (e) {
      return fail(500, { error: 'Network error' });
    }
  },
};
