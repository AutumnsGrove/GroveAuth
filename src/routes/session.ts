/**
 * Session Routes - SessionDO-based session management with D1/JWT fallback
 *
 * New endpoints:
 * - POST /session/validate - Validate session, return user info
 * - POST /session/revoke - Revoke current session (logout)
 * - POST /session/revoke-all - Revoke all sessions (logout everywhere)
 * - GET /session/list - List all active sessions
 * - DELETE /session/:sessionId - Revoke specific session
 * - GET /session/check - Legacy compatibility endpoint
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
import { verifyAccessToken } from '../services/jwt.js';
import { createDbSession } from '../db/session.js';
import {
  getSessionFromRequest,
  clearSessionCookieHeader,
  parseSessionCookie,
} from '../lib/session.js';
import type { SessionDO } from '../durables/SessionDO.js';
import { checkRouteRateLimit } from '../middleware/rateLimit.js';
import { getClientIP } from '../middleware/security.js';
import {
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_SESSION_VALIDATE,
  RATE_LIMIT_SESSION_REVOKE,
  RATE_LIMIT_SESSION_REVOKE_ALL,
  RATE_LIMIT_SESSION_REVOKE_ALL_WINDOW,
  RATE_LIMIT_SESSION_LIST,
  RATE_LIMIT_SESSION_DELETE,
  RATE_LIMIT_SESSION_CHECK,
  RATE_LIMIT_SESSION_SERVICE,
} from '../utils/constants.js';

const session = new Hono<{ Bindings: Env }>();

/**
 * POST /session/validate
 * Validate session and return user info
 * Supports: grove_session cookie (SessionDO) -> access_token cookie (JWT) -> session cookie (D1)
 */
session.post('/validate', async (c) => {
  const db = createDbSession(c.env);

  // Rate limit by IP
  const rateLimit = await checkRouteRateLimit(
    db,
    'session_validate',
    getClientIP(c.req.raw),
    RATE_LIMIT_SESSION_VALIDATE,
    RATE_LIMIT_WINDOW
  );
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: rateLimit.retryAfter },
      429
    );
  }

  // Try SessionDO first (new system)
  const parsedSession = await getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);

  if (parsedSession) {
    const sessionDO = c.env.SESSIONS.get(
      c.env.SESSIONS.idFromName(`session:${parsedSession.userId}`)
    ) as DurableObjectStub<SessionDO>;

    const result = await sessionDO.validateSession(parsedSession.sessionId);

    if (result.valid) {
      const user = await getUserById(db, parsedSession.userId);

      if (user) {
        const isAdmin = user.is_admin === 1 || isEmailAdmin(user.email);

        return c.json({
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            isAdmin,
          },
          session: {
            id: parsedSession.sessionId,
            deviceName: result.session?.deviceName,
            lastActiveAt: result.session?.lastActiveAt,
          },
        });
      }
    }
  }

  // Fallback to JWT access_token cookie
  const cookieHeader = c.req.header('Cookie') || '';
  const accessTokenMatch = cookieHeader.match(/access_token=([^;]+)/);

  if (accessTokenMatch) {
    try {
      const payload = await verifyAccessToken(c.env, accessTokenMatch[1]);

      if (payload?.sub) {
        const user = await getUserById(db, payload.sub);

        if (user) {
          const isAdmin = user.is_admin === 1 || isEmailAdmin(user.email);

          return c.json({
            valid: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatar_url,
              isAdmin,
            },
            session: null, // No DO session for JWT auth
          });
        }
      }
    } catch {
      // JWT invalid, fall through
    }
  }

  // Fallback to legacy D1 session cookie
  const sessionMatch = cookieHeader.match(/session=([^;]+)/);
  if (sessionMatch) {
    const sessionToken = sessionMatch[1];
    const sessionHash = await hashSecret(sessionToken);
    const sessionData = await getSessionByTokenHash(db, sessionHash);

    if (sessionData) {
      const user = await getUserById(db, sessionData.user_id);
      if (user) {
        const isAdmin = user.is_admin === 1 || isEmailAdmin(user.email);

        return c.json({
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            isAdmin,
          },
          session: null, // No DO session for legacy auth
        });
      }
    }
  }

  return c.json({ valid: false });
});

/**
 * POST /session/revoke
 * Revoke current session (logout)
 */
session.post('/revoke', async (c) => {
  const db = createDbSession(c.env);

  // Rate limit by IP
  const rateLimit = await checkRouteRateLimit(
    db,
    'session_revoke',
    getClientIP(c.req.raw),
    RATE_LIMIT_SESSION_REVOKE,
    RATE_LIMIT_WINDOW
  );
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: rateLimit.retryAfter },
      429
    );
  }

  const parsedSession = await getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);

  if (!parsedSession) {
    return c.json({ success: false, error: 'No session' }, 401);
  }

  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${parsedSession.userId}`)
  ) as DurableObjectStub<SessionDO>;

  await sessionDO.revokeSession(parsedSession.sessionId);

  // Clear all session-related cookies
  const clearCookies = [
    clearSessionCookieHeader(),
    'access_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=.grove.place; Max-Age=0',
    'refresh_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=.grove.place; Max-Age=0',
  ];

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookies.join(', '),
    },
  });
});

/**
 * POST /session/revoke-all
 * Revoke all sessions (logout from all devices)
 */
session.post('/revoke-all', async (c) => {
  const db = createDbSession(c.env);

  // Rate limit by IP (stricter limit: 3 per hour)
  const rateLimit = await checkRouteRateLimit(
    db,
    'session_revoke_all',
    getClientIP(c.req.raw),
    RATE_LIMIT_SESSION_REVOKE_ALL,
    RATE_LIMIT_SESSION_REVOKE_ALL_WINDOW
  );
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: rateLimit.retryAfter },
      429
    );
  }

  const parsedSession = await getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);

  if (!parsedSession) {
    return c.json({ success: false, error: 'No session' }, 401);
  }

  let keepCurrent = false;
  try {
    const body = await c.req.json<{ keepCurrent?: boolean }>();
    keepCurrent = body.keepCurrent ?? false;
  } catch {
    // No body, revoke all
  }

  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${parsedSession.userId}`)
  ) as DurableObjectStub<SessionDO>;

  const count = await sessionDO.revokeAllSessions(
    keepCurrent ? parsedSession.sessionId : undefined
  );

  return c.json({ success: true, revokedCount: count });
});

/**
 * GET /session/list
 * List all active sessions for current user
 */
session.get('/list', async (c) => {
  const db = createDbSession(c.env);

  // Rate limit by IP
  const rateLimit = await checkRouteRateLimit(
    db,
    'session_list',
    getClientIP(c.req.raw),
    RATE_LIMIT_SESSION_LIST,
    RATE_LIMIT_WINDOW
  );
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: rateLimit.retryAfter },
      429
    );
  }

  const parsedSession = await getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);

  if (!parsedSession) {
    return c.json({ sessions: [] }, 401);
  }

  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${parsedSession.userId}`)
  ) as DurableObjectStub<SessionDO>;

  const sessions = await sessionDO.listSessions();

  const sessionsWithCurrent = sessions.map((s) => ({
    ...s,
    isCurrent: s.id === parsedSession.sessionId,
  }));

  return c.json({ sessions: sessionsWithCurrent });
});

/**
 * DELETE /session/:sessionId
 * Revoke a specific session by ID (must be own session)
 */
session.delete('/:sessionId', async (c) => {
  const db = createDbSession(c.env);

  // Rate limit by IP
  const rateLimit = await checkRouteRateLimit(
    db,
    'session_delete',
    getClientIP(c.req.raw),
    RATE_LIMIT_SESSION_DELETE,
    RATE_LIMIT_WINDOW
  );
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: rateLimit.retryAfter },
      429
    );
  }

  const parsedSession = await getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);

  if (!parsedSession) {
    return c.json({ success: false, error: 'No session' }, 401);
  }

  const sessionIdToRevoke = c.req.param('sessionId');

  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${parsedSession.userId}`)
  ) as DurableObjectStub<SessionDO>;

  const revoked = await sessionDO.revokeSession(sessionIdToRevoke);

  if (!revoked) {
    return c.json({ success: false, error: 'Session not found' }, 404);
  }

  return c.json({ success: true });
});

/**
 * GET /session/check - Legacy compatibility endpoint
 * Check if user has valid session and get redirect info
 */
session.get('/check', async (c) => {
  const db = createDbSession(c.env);

  // Rate limit by IP
  const rateLimit = await checkRouteRateLimit(
    db,
    'session_check',
    getClientIP(c.req.raw),
    RATE_LIMIT_SESSION_CHECK,
    RATE_LIMIT_WINDOW
  );
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: rateLimit.retryAfter },
      429
    );
  }

  // Try SessionDO first (new system)
  const parsedSession = await getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);

  if (parsedSession) {
    const sessionDO = c.env.SESSIONS.get(
      c.env.SESSIONS.idFromName(`session:${parsedSession.userId}`)
    ) as DurableObjectStub<SessionDO>;

    const result = await sessionDO.validateSession(parsedSession.sessionId);

    if (result.valid) {
      const user = await getUserById(db, parsedSession.userId);

      if (user) {
        const isAdmin = user.is_admin === 1 || isEmailAdmin(user.email);
        const prefs = await getUserClientPreference(db, user.id);

        return c.json({
          authenticated: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            is_admin: isAdmin,
          },
          client: null,
          last_used_client_id: prefs?.last_used_client_id || null,
        });
      }
    }
  }

  const cookieHeader = c.req.header('Cookie') || '';

  // Try access_token (cross-subdomain auth)
  const accessTokenMatch = cookieHeader.match(/access_token=([^;]+)/);
  if (accessTokenMatch) {
    try {
      const accessToken = accessTokenMatch[1];
      const payload = await verifyAccessToken(c.env, accessToken);

      if (payload && payload.sub) {
        const user = await getUserById(db, payload.sub);
        if (user) {
          const isAdmin = user.is_admin === 1 || isEmailAdmin(user.email);
          const clientId = payload.client_id as string | undefined;
          const client = clientId ? await getClientByClientId(db, clientId) : null;
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

  const user = await getUserById(db, sessionData.user_id);
  if (!user) {
    return c.json({ authenticated: false });
  }

  const client = await getClientByClientId(db, sessionData.client_id);
  const prefs = await getUserClientPreference(db, sessionData.user_id);
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

/**
 * POST /session/validate-service
 * Validate a session token for internal Grove services (like Mycelium)
 * Unlike /validate which uses cookies, this accepts the token in the request body
 */
session.post('/validate-service', async (c) => {
  const db = createDbSession(c.env);

  // Rate limit by IP (higher limit for internal services)
  const rateLimit = await checkRouteRateLimit(
    db,
    'session_service',
    getClientIP(c.req.raw),
    RATE_LIMIT_SESSION_SERVICE,
    RATE_LIMIT_WINDOW
  );
  if (!rateLimit.allowed) {
    return c.json(
      { valid: false, error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: rateLimit.retryAfter },
      429
    );
  }

  let sessionToken: string;
  try {
    const body = await c.req.json<{ session_token: string }>();
    sessionToken = body.session_token;
  } catch {
    return c.json({ valid: false, error: 'Invalid request body' }, 400);
  }

  if (!sessionToken) {
    return c.json({ valid: false, error: 'Missing session_token' }, 400);
  }

  // Parse and verify the session token signature
  const parsedSession = await parseSessionCookie(sessionToken, c.env.SESSION_SECRET);

  if (!parsedSession) {
    return c.json({ valid: false, error: 'Invalid session token signature' }, 401);
  }

  // Validate the session in SessionDO
  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${parsedSession.userId}`)
  ) as DurableObjectStub<SessionDO>;

  const result = await sessionDO.validateSession(parsedSession.sessionId);

  if (!result.valid) {
    return c.json({ valid: false, error: 'Session expired or revoked' }, 401);
  }

  // Get user info
  const user = await getUserById(db, parsedSession.userId);

  if (!user) {
    return c.json({ valid: false, error: 'User not found' }, 401);
  }

  const isAdmin = user.is_admin === 1 || isEmailAdmin(user.email);

  return c.json({
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      isAdmin,
    },
    session: {
      id: parsedSession.sessionId,
      deviceName: result.session?.deviceName,
      lastActiveAt: result.session?.lastActiveAt,
    },
  });
});

export default session;
