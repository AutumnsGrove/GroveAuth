/**
 * Better Auth Routes
 *
 * This route handler integrates Better Auth with the Hono app,
 * providing the new /api/auth/* endpoints for authentication.
 *
 * Endpoints handled by Better Auth:
 * - POST /api/auth/sign-in/social - OAuth sign-in (Google, GitHub)
 * - POST /api/auth/sign-in/magic-link - Magic link sign-in
 * - POST /api/auth/sign-in/passkey - Passkey sign-in
 * - GET /api/auth/callback/:provider - OAuth callbacks
 * - POST /api/auth/passkey/register - Register new passkey
 * - GET /api/auth/session - Get current session
 * - POST /api/auth/sign-out - Sign out
 * - And more...
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { createAuth } from '../auth/index.js';

const betterAuthRoutes = new Hono<{ Bindings: Env }>();

/**
 * Catch-all handler for Better Auth endpoints
 *
 * Better Auth provides its own request handler that processes
 * all authentication-related requests under the /api/auth/* path.
 */
betterAuthRoutes.all('/*', async (c) => {
  try {
    // Extract geolocation fields from Cloudflare request context
    const rawCf = c.req.raw.cf;
    const cf = rawCf ? {
      timezone: rawCf.timezone as string | undefined,
      city: rawCf.city as string | undefined,
      country: rawCf.country as string | undefined,
      region: rawCf.region as string | undefined,
      regionCode: rawCf.regionCode as string | undefined,
      colo: rawCf.colo as string | undefined,
      latitude: rawCf.latitude as string | undefined,
      longitude: rawCf.longitude as string | undefined,
    } : undefined;

    console.log('[BetterAuth] Request:', c.req.method, c.req.path);

    // Create auth instance with current environment bindings and CF context
    const auth = createAuth(c.env, cf);

    // Better Auth handler expects a standard Request and returns a Response
    const response = await auth.handler(c.req.raw);

    // Log response status for debugging
    console.log('[BetterAuth] Response status:', response.status);

    // If it's a 500 error, try to get more details
    if (response.status >= 500) {
      const clonedResponse = response.clone();
      try {
        const body = await clonedResponse.text();
        console.error('[BetterAuth] 5xx response body:', body || '(empty)');
      } catch (e) {
        console.error('[BetterAuth] Could not read response body');
      }
    }

    return response;
  } catch (error) {
    // Log the actual error for debugging
    console.error('[BetterAuth] Handler error:', error);
    console.error('[BetterAuth] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[BetterAuth] Request path:', c.req.path);

    return c.json({
      error: 'server_error',
      message: 'An unexpected error occurred',
      debug: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

export default betterAuthRoutes;
