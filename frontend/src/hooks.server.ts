/**
 * Server Hooks - Subdomain detection for multi-domain routing
 */

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // On Cloudflare Pages with custom domains, x-forwarded-host contains the original hostname
  const hostname = event.request.headers.get('x-forwarded-host')
    || event.request.headers.get('host')
    || '';

  // Detect which subdomain we're on
  if (hostname.includes('login.grove.place') || hostname.startsWith('login.')) {
    event.locals.subdomain = 'login';
  } else if (hostname.includes('admin.grove.place') || hostname.startsWith('admin.')) {
    event.locals.subdomain = 'admin';
  } else {
    event.locals.subdomain = 'auth';
  }

  return resolve(event);
};
