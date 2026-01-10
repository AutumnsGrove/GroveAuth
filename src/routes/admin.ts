/**
 * Admin Routes - Dashboard statistics and management
 * All routes require admin access (autumn@grove.place or autumnbrown23@pm.me)
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import {
  getAdminStats,
  isUserAdmin,
  getAllUsers,
  getAuditLogs,
  getAllClients,
  getTwoFactorRequirementStatus,
  setTwoFactorExemption,
  setTwoFactorBypass,
  clearTwoFactorBypass,
} from '../db/queries.js';
import { verifyAccessToken } from '../services/jwt.js';
import { createDbSession } from '../db/session.js';

const admin = new Hono<{ Bindings: Env }>();

/**
 * Middleware: Verify admin access
 */
admin.use('/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized', error_description: 'Missing or invalid token' }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyAccessToken(c.env, token);

  if (!payload) {
    return c.json({ error: 'invalid_token', error_description: 'Token is invalid or expired' }, 401);
  }

  const db = createDbSession(c.env);
  const isAdmin = await isUserAdmin(db, payload.sub);
  if (!isAdmin) {
    return c.json({ error: 'forbidden', error_description: 'Admin access required' }, 403);
  }

  await next();
});

/**
 * GET /admin/stats - Get dashboard statistics
 */
admin.get('/stats', async (c) => {
  const db = createDbSession(c.env);
  const stats = await getAdminStats(db, c.env.ENGINE_DB);

  // Get replication info from the last query
  const replicationInfo = {
    served_by_region: null as string | null,
    served_by_primary: null as boolean | null,
  };

  // Run a simple query to get current replication status
  try {
    const result = await db.prepare('SELECT 1').run();
    replicationInfo.served_by_region = result.meta?.served_by_region ?? null;
    replicationInfo.served_by_primary = result.meta?.served_by_primary ?? null;
  } catch {
    // Ignore errors, replication info is optional
  }

  return c.json({
    ...stats,
    replication: replicationInfo,
  });
});

/**
 * GET /admin/users - List all users with pagination
 */
admin.get('/users', async (c) => {
  const db = createDbSession(c.env);
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const users = await getAllUsers(db, limit, offset);

  return c.json({ users });
});

/**
 * GET /admin/audit-log - Get audit log entries with filtering
 */
admin.get('/audit-log', async (c) => {
  const db = createDbSession(c.env);
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');
  const eventType = c.req.query('event_type') || undefined;

  const logs = await getAuditLogs(db, { limit, offset, eventType });

  return c.json({ logs });
});

/**
 * GET /admin/clients - List all registered clients
 */
admin.get('/clients', async (c) => {
  const db = createDbSession(c.env);
  const clients = await getAllClients(db);

  // Remove sensitive data
  const safeClients = clients.map(client => ({
    id: client.id,
    name: client.name,
    client_id: client.client_id,
    domain: client.domain,
    redirect_uris: JSON.parse(client.redirect_uris),
    allowed_origins: JSON.parse(client.allowed_origins),
    created_at: client.created_at,
  }));

  return c.json({ clients: safeClients });
});

// ==================== Two-Factor Authentication Management ====================

/**
 * GET /admin/users/:userId/2fa-status - Get user's 2FA requirement status
 */
admin.get('/users/:userId/2fa-status', async (c) => {
  const db = createDbSession(c.env);
  const userId = c.req.param('userId');

  const status = await getTwoFactorRequirementStatus(db, userId);

  return c.json({
    userId,
    twoFactorStatus: {
      ...status,
      bypassUntil: status.bypassUntil?.toISOString() || null,
    },
  });
});

/**
 * POST /admin/users/:userId/2fa-exempt - Set 2FA exemption for a user
 * Body: { exempt: boolean }
 *
 * Use this to override 2FA requirement for users who are locked out.
 */
admin.post('/users/:userId/2fa-exempt', async (c) => {
  const db = createDbSession(c.env);
  const userId = c.req.param('userId');

  let body: { exempt?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_request', error_description: 'Invalid JSON body' }, 400);
  }

  if (typeof body.exempt !== 'boolean') {
    return c.json({
      error: 'invalid_request',
      error_description: 'Body must contain { exempt: boolean }',
    }, 400);
  }

  await setTwoFactorExemption(db, userId, body.exempt);
  const status = await getTwoFactorRequirementStatus(db, userId);

  console.log(`[Admin] Set 2FA exemption for user ${userId} to ${body.exempt}`);

  return c.json({
    userId,
    exempt: body.exempt,
    twoFactorStatus: {
      ...status,
      bypassUntil: status.bypassUntil?.toISOString() || null,
    },
  });
});

/**
 * POST /admin/users/:userId/2fa-bypass - Set temporary 2FA bypass for a user
 * Body: { hours: number } - Number of hours for bypass (default 24, max 168 = 1 week)
 *
 * Use this to give users time to set up 2FA after being locked out.
 */
admin.post('/users/:userId/2fa-bypass', async (c) => {
  const db = createDbSession(c.env);
  const userId = c.req.param('userId');

  let body: { hours?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_request', error_description: 'Invalid JSON body' }, 400);
  }

  const hours = body.hours ?? 24;
  if (typeof hours !== 'number' || hours < 1 || hours > 168) {
    return c.json({
      error: 'invalid_request',
      error_description: 'Body must contain { hours: number } between 1 and 168',
    }, 400);
  }

  const bypassUntil = await setTwoFactorBypass(db, userId, hours);
  const status = await getTwoFactorRequirementStatus(db, userId);

  console.log(`[Admin] Set ${hours}-hour 2FA bypass for user ${userId} until ${bypassUntil.toISOString()}`);

  return c.json({
    userId,
    bypassUntil: bypassUntil.toISOString(),
    twoFactorStatus: {
      ...status,
      bypassUntil: status.bypassUntil?.toISOString() || null,
    },
  });
});

/**
 * DELETE /admin/users/:userId/2fa-bypass - Clear 2FA bypass for a user
 */
admin.delete('/users/:userId/2fa-bypass', async (c) => {
  const db = createDbSession(c.env);
  const userId = c.req.param('userId');

  await clearTwoFactorBypass(db, userId);
  const status = await getTwoFactorRequirementStatus(db, userId);

  console.log(`[Admin] Cleared 2FA bypass for user ${userId}`);

  return c.json({
    userId,
    bypassUntil: null,
    twoFactorStatus: {
      ...status,
      bypassUntil: null,
    },
  });
});

export default admin;
