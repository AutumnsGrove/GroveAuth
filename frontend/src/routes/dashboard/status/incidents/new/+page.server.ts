import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { AUTH_API_URL } from '$lib/config';

export const load: PageServerLoad = async ({ parent, cookies }) => {
  const { session } = await parent();

  if (!session.authenticated || !session.user?.is_admin) {
    throw redirect(303, '/dashboard/status');
  }

  const accessToken = cookies.get('access_token');

  // Fetch components for multi-select
  try {
    const response = await fetch(`${AUTH_API_URL}/status/components`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json();
    return { components: data.components || [] };
  } catch (e) {
    return { components: [] };
  }
};

export const actions: Actions = {
  createIncident: async ({ request, cookies }) => {
    const formData = await request.formData();
    const accessToken = cookies.get('access_token');

    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const impact = formData.get('impact') as string;
    const componentsJson = formData.get('components') as string;
    const initialStatus = formData.get('initialStatus') as string;
    const initialMessage = formData.get('initialMessage') as string;

    let components: string[];
    try {
      components = JSON.parse(componentsJson);
    } catch (e) {
      return fail(400, { error: 'Invalid components selection' });
    }

    if (!title || !type || !impact || components.length === 0 || !initialStatus || !initialMessage) {
      return fail(400, { error: 'All fields are required' });
    }

    try {
      const response = await fetch(`${AUTH_API_URL}/status/incidents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          type,
          impact,
          components,
          initialStatus,
          initialMessage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return fail(response.status, { error: errorData.error || 'Failed to create incident' });
      }

      const data = await response.json();

      // Redirect to incident detail page
      throw redirect(303, `/dashboard/status/incidents/${data.incident.id}`);
    } catch (e) {
      if (e instanceof Response) throw e; // Re-throw redirects
      return fail(500, { error: 'Network error' });
    }
  },
};
