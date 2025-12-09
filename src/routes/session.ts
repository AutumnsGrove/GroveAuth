/**
 * Session Routes - Session management and redirect info
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import {
  getSessionByTokenHash,
  getUserById,
  getUserByEmail,
  getClientByClientId,
  getUserClientPreference,
  isEmailAdmin,
} from '../db/queries.js';
import { hashSecret } from '../utils/crypto.js';
import { verifyAccessToken } from '../services/jwt.js';
import { createDbSession } from '../db/session.js';

const session = new Hono<{ Bindings: Env }>();

/**
 * GET /session/check - Check if user has valid session and get redirect info
 * Used by frontend to determine redirect behavior for login.grove.place and admin.grove.place
 *
 * Supports two authentication methods:
 * 1. Session token in cookie (legacy)
 * 2. Access token in cookie (cross-subdomain auth from grove.place)
 */
session.get('/check', async (c) => {
  const db = createDbSession(c.env);
  const cookieHeader = c.req.header('Cookie') || '';

  // Try access_token first (cross-subdomain auth)
  const accessTokenMatch = cookieHeader.match(/access_token=([^;]+)/);
  if (accessTokenMatch) {
    try {
      const accessToken = accessTokenMatch[1];
      const payload = await verifyAccessToken(c.env, accessToken);

      if (payload && payload.email) {
        // Get user by email from token
        const user = await getUserByEmail(db, payload.email);
        if (user) {
          const isAdmin = user.is_admin === 1 || isEmailAdmin(user.email);

          // Get client info if available
          const clientId = payload.client_id as string | undefined;
          const client = clientId ? await getClientByClientId(db, clientId) : null;

          // Get user's client preference
          const prefs = await getUserClientPreference(db, user.id);

          return c.json({
            authenticated: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              is_admin: isAdmin,
            },
            client: client
              ? {
                  id: client.client_id,
                  name: client.name,
                  domain: client.domain,
                }
              : null,
            last_used_client_id: prefs?.last_used_client_id || null,
          });
        }
      }
    } catch {
      // Token invalid, continue to session check
    }
  }

  // Try session token (legacy method)
  const sessionMatch = cookieHeader.match(/session=([^;]+)/);

  if (!sessionMatch) {
    return c.json({ authenticated: false });
  }

  const sessionToken = sessionMatch[1];
  const sessionHash = await hashSecret(sessionToken);
  const sessionData = await getSessionByTokenHash(db, sessionHash);

  if (!sessionData) {
    return c.json({ authenticated: false });
  }

  // Get user info
  const user = await getUserById(db, sessionData.user_id);
  if (!user) {
    return c.json({ authenticated: false });
  }

  // Get client info
  const client = await getClientByClientId(db, sessionData.client_id);

  // Get user's client preference
  const prefs = await getUserClientPreference(db, sessionData.user_id);

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
    client: client
      ? {
          id: client.client_id,
          name: client.name,
          domain: client.domain,
        }
      : null,
    last_used_client_id: prefs?.last_used_client_id || null,
  });
});

export default session;
