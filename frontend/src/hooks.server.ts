/**
 * Server Hooks - Subdomain detection for multi-domain routing
 */

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // On Cloudflare Pages with custom domains, we need to check headers
  // The Host header contains the original requested hostname
  const hostHeader = event.request.headers.get('host') || '';
  const xForwardedHost = event.request.headers.get('x-forwarded-host') || '';

  // Prefer x-forwarded-host if available, otherwise use host header
  const hostname = xForwardedHost || hostHeader;

  // Detect which subdomain we're on
  if (hostname.includes('login.grove.place') || hostname.startsWith('login.')) {
    event.locals.subdomain = 'login';
  } else if (hostname.includes('admin.grove.place') || hostname.startsWith('admin.')) {
    event.locals.subdomain = 'admin';
  } else {
    event.locals.subdomain = 'auth';
  }

  // Store debug info
  (event.locals as any).debugHostname = hostname;
  (event.locals as any).debugHostHeader = hostHeader;
  (event.locals as any).debugXForwardedHost = xForwardedHost;

  return resolve(event);
};
