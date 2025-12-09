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
  const stats = await getAdminStats(db);
  return c.json(stats);
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

export default admin;
