/**
 * Minecraft Routes - Proxy to mc-control worker
 * All routes require admin access
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { isUserAdmin } from '../db/queries.js';
import { verifyAccessToken } from '../services/jwt.js';
import { createDbSession } from '../db/session.js';

const MC_CONTROL_URL = 'https://mc-control.grove.workers.dev';

const minecraft = new Hono<{ Bindings: Env }>();

/**
 * Middleware: Verify admin access
 */
minecraft.use('/*', async (c, next) => {
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

  // Store the token for forwarding to mc-control
  c.set('accessToken', token);
  await next();
});

/**
 * Helper to proxy requests to mc-control
 */
async function proxyToMcControl(
  c: any,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const token = c.get('accessToken');
  const url = `${MC_CONTROL_URL}${path}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('mc-control proxy error:', error);
    return c.json({
      error: 'proxy_error',
      error_description: 'Failed to communicate with Minecraft control service',
    }, 502);
  }
}

/**
 * GET /minecraft/status - Get full server status
 */
minecraft.get('/status', async (c) => {
  return proxyToMcControl(c, 'GET', '/api/mc/status');
});

/**
 * POST /minecraft/start - Start the server
 */
minecraft.post('/start', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return proxyToMcControl(c, 'POST', '/api/mc/start', body);
});

/**
 * POST /minecraft/stop - Stop the server
 */
minecraft.post('/stop', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return proxyToMcControl(c, 'POST', '/api/mc/stop', body);
});

/**
 * GET /minecraft/whitelist - Get whitelist
 */
minecraft.get('/whitelist', async (c) => {
  return proxyToMcControl(c, 'GET', '/api/mc/whitelist');
});

/**
 * POST /minecraft/whitelist - Add/remove from whitelist
 */
minecraft.post('/whitelist', async (c) => {
  const body = await c.req.json();
  return proxyToMcControl(c, 'POST', '/api/mc/whitelist', body);
});

/**
 * POST /minecraft/command - Send console command
 */
minecraft.post('/command', async (c) => {
  const body = await c.req.json();
  return proxyToMcControl(c, 'POST', '/api/mc/command', body);
});

/**
 * POST /minecraft/sync - Trigger manual backup
 */
minecraft.post('/sync', async (c) => {
  return proxyToMcControl(c, 'POST', '/api/mc/sync');
});

/**
 * GET /minecraft/history - Get session history
 */
minecraft.get('/history', async (c) => {
  const limit = c.req.query('limit');
  const offset = c.req.query('offset');
  const months = c.req.query('months');

  let path = '/api/mc/history';
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  if (months) params.set('months', months);

  if (params.toString()) {
    path += `?${params.toString()}`;
  }

  return proxyToMcControl(c, 'GET', path);
});

export default minecraft;
