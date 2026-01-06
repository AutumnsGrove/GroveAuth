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
  // Create auth instance with current environment bindings
  const auth = createAuth(c.env);

  // Better Auth handler expects a standard Request and returns a Response
  const response = await auth.handler(c.req.raw);

  return response;
});

export default betterAuthRoutes;
