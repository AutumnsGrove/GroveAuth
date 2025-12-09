/**
 * Health Check Route
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { createDbSession } from '../db/session.js';

const health = new Hono<{ Bindings: Env }>();

/**
 * GET /health - Health check endpoint
 */
health.get('/', async (c) => {
  const db = createDbSession(c.env);
  const timestamp = new Date().toISOString();

  // Optionally check database connectivity
  let dbStatus = 'unknown';
  try {
    await db.prepare('SELECT 1').first();
    dbStatus = 'healthy';
  } catch {
    dbStatus = 'unhealthy';
  }

  return c.json({
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp,
    components: {
      database: dbStatus,
    },
  });
});

export default health;
