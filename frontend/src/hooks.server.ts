/**
 * Server Hooks - Subdomain detection for multi-domain routing
 */

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const host = event.request.headers.get('host') || '';

  // Detect which subdomain we're on
  if (host.startsWith('login.') || host.includes('login.grove.place')) {
    event.locals.subdomain = 'login';
  } else if (host.startsWith('admin.') || host.includes('admin.grove.place')) {
    event.locals.subdomain = 'admin';
  } else {
    event.locals.subdomain = 'auth';
  }

  return resolve(event);
};
