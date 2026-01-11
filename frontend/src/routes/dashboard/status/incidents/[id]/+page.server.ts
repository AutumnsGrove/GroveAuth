import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { AUTH_API_URL } from '$lib/config';

export const load: PageServerLoad = async ({ params, parent, cookies }) => {
  const { session } = await parent();

  if (!session.authenticated || !session.user?.is_admin) {
    throw redirect(303, '/dashboard/status');
  }

  const { id } = params;
  const accessToken = cookies.get('access_token');

  try {
    const response = await fetch(`${AUTH_API_URL}/status/incidents/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw redirect(303, '/dashboard/status');
    }

    const data = await response.json();
    return { incident: data.incident };
  } catch (e) {
    throw redirect(303, '/dashboard/status');
  }
};

export const actions: Actions = {
  postUpdate: async ({ params, request, cookies }) => {
    const { id } = params;
    const formData = await request.formData();
    const accessToken = cookies.get('access_token');

    const status = formData.get('status') as string;
    const message = formData.get('message') as string;

    if (!status || !message) {
      return fail(400, { error: 'Status and message are required' });
    }

    try {
      const response = await fetch(`${AUTH_API_URL}/status/incidents/${id}/updates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, message }),
      });

      if (!response.ok) {
        return fail(response.status, { error: 'Failed to post update' });
      }

      return { success: true, message: 'Update posted' };
    } catch (e) {
      return fail(500, { error: 'Network error' });
    }
  },

  resolve: async ({ params, cookies }) => {
    const { id } = params;
    const accessToken = cookies.get('access_token');

    try {
      const response = await fetch(`${AUTH_API_URL}/status/incidents/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'resolved', resolved: true }),
      });

      if (!response.ok) {
        return fail(response.status, { error: 'Failed to resolve incident' });
      }

      return { success: true, message: 'Incident marked as resolved' };
    } catch (e) {
      return fail(500, { error: 'Network error' });
    }
  },
};
