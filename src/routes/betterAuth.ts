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
 *
 * Security enhancements:
 * - Passkey-specific rate limiting (defense-in-depth)
 * - Audit logging for passkey registration/deletion/auth events
 * - Stricter CSP headers for passkey operations
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { createAuth } from '../auth/index.js';
import { createAuditLog } from '../db/queries.js';
import { createDbSession } from '../db/session.js';
import { getClientIP, getUserAgent } from '../middleware/security.js';
import {
  passkeyRegisterRateLimiter,
  passkeyDeleteRateLimiter,
  passkeyAuthRateLimiter,
} from '../middleware/rateLimit.js';
import { SECURITY_PAGE_CSP } from '../utils/constants.js';

const betterAuthRoutes = new Hono<{ Bindings: Env }>();

/**
 * Apply stricter CSP headers for passkey-related routes
 */
betterAuthRoutes.use('/passkey/*', async (c, next) => {
  await next();
  c.res.headers.set('Content-Security-Policy', SECURITY_PAGE_CSP);
});

/**
 * Rate limiting for passkey registration
 */
betterAuthRoutes.post('/passkey/verify-registration', passkeyRegisterRateLimiter);

/**
 * Rate limiting for passkey deletion
 */
betterAuthRoutes.post('/passkey/delete-passkey', passkeyDeleteRateLimiter);

/**
 * Rate limiting for passkey authentication
 */
betterAuthRoutes.post('/passkey/verify-authentication', passkeyAuthRateLimiter);

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

    // Audit logging for passkey operations (non-blocking, fire-and-forget)
    const path = c.req.path;
    const isPasskeyOp = path.includes('/passkey/');
    if (isPasskeyOp) {
      const db = createDbSession(c.env);
      const ipAddress = getClientIP(c.req.raw);
      const userAgent = getUserAgent(c.req.raw);

      // Determine event type and success based on path and response status
      const isSuccess = response.status >= 200 && response.status < 300;

      // Fire-and-forget audit logging (don't await to avoid blocking response)
      (async () => {
        try {
          // Extract user info from response if available (for registration/deletion)
          let userId: string | undefined;
          let details: Record<string, unknown> = { statusCode: response.status };

          if (path.includes('/verify-registration')) {
            await createAuditLog(db, {
              event_type: isSuccess ? 'passkey_registered' : 'passkey_auth_failed',
              user_id: userId,
              ip_address: ipAddress,
              user_agent: userAgent,
              details: { ...details, operation: 'register' },
            });
          } else if (path.includes('/delete-passkey')) {
            await createAuditLog(db, {
              event_type: isSuccess ? 'passkey_deleted' : 'passkey_auth_failed',
              user_id: userId,
              ip_address: ipAddress,
              user_agent: userAgent,
              details: { ...details, operation: 'delete' },
            });
          } else if (path.includes('/verify-authentication')) {
            await createAuditLog(db, {
              event_type: isSuccess ? 'passkey_auth_success' : 'passkey_auth_failed',
              user_id: userId,
              ip_address: ipAddress,
              user_agent: userAgent,
              details: { ...details, operation: 'authenticate' },
            });
          }
        } catch (auditError) {
          // Log but don't fail the request if audit logging fails
          console.error('[BetterAuth] Audit logging failed:', auditError);
        }
      })();
    }

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
