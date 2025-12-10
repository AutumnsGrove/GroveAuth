/**
 * Server Hooks - Subdomain detection for multi-domain routing
 */

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Try multiple sources for hostname detection on Cloudflare Pages
  const hostname = event.url.hostname
    || event.request.headers.get('host')?.split(':')[0]
    || '';

  // Detect which subdomain we're on
  if (hostname.includes('login.grove.place') || hostname.startsWith('login.')) {
    event.locals.subdomain = 'login';
  } else if (hostname.includes('admin.grove.place') || hostname.startsWith('admin.')) {
    event.locals.subdomain = 'admin';
  } else {
    event.locals.subdomain = 'auth';
  }

  // Debug: Log what we're seeing (check in Cloudflare Pages logs)
  console.log('[hooks] hostname:', hostname, '-> subdomain:', event.locals.subdomain);

  return resolve(event);
};
