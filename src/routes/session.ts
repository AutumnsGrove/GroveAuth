/**
 * Session Routes - Session management and redirect info
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import {
  getSessionByTokenHash,
  getUserById,
  getClientByClientId,
  getUserClientPreference,
  isEmailAdmin,
} from '../db/queries.js';
import { hashSecret } from '../utils/crypto.js';

const session = new Hono<{ Bindings: Env }>();

/**
 * GET /session/check - Check if user has valid session and get redirect info
 * Used by frontend to determine redirect behavior for login.grove.place and admin.grove.place
 */
session.get('/check', async (c) => {
  // Get session from cookie
  const cookieHeader = c.req.header('Cookie') || '';
  const sessionMatch = cookieHeader.match(/session=([^;]+)/);

  if (!sessionMatch) {
    return c.json({ authenticated: false });
  }

  const sessionToken = sessionMatch[1];
  const sessionHash = await hashSecret(sessionToken);
  const sessionData = await getSessionByTokenHash(c.env.DB, sessionHash);

  if (!sessionData) {
    return c.json({ authenticated: false });
  }

  // Get user info
  const user = await getUserById(c.env.DB, sessionData.user_id);
  if (!user) {
    return c.json({ authenticated: false });
  }

  // Get client info
  const client = await getClientByClientId(c.env.DB, sessionData.client_id);

  // Get user's client preference
  const prefs = await getUserClientPreference(c.env.DB, sessionData.user_id);

  // Check if user is admin
  const isAdmin = user.is_admin === 1 || isEmailAdmin(user.email);

  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: isAdmin,
    },
    client: client ? {
      id: client.client_id,
      name: client.name,
      domain: client.domain,
    } : null,
    last_used_client_id: prefs?.last_used_client_id || null,
  });
});

export default session;
