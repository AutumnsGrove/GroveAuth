/**
 * Server Hooks - Subdomain detection for multi-domain routing
 */

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Use event.url.hostname which is more reliable on Cloudflare Pages
  const hostname = event.url.hostname;

  // Detect which subdomain we're on
  if (hostname.startsWith('login.') || hostname === 'login.grove.place') {
    event.locals.subdomain = 'login';
  } else if (hostname.startsWith('admin.') || hostname === 'admin.grove.place') {
    event.locals.subdomain = 'admin';
  } else {
    event.locals.subdomain = 'auth';
  }

  return resolve(event);
};
