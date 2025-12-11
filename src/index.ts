/**
 * GroveAuth - Main Entry Point
 * Centralized authentication service for AutumnsGrove properties
 */

import { Hono } from 'hono';
import type { Env } from './types.js';

// Middleware
import { securityHeaders } from './middleware/security.js';
import { corsMiddleware } from './middleware/cors.js';

// Routes
import login from './routes/login.js';
import google from './routes/oauth/google.js';
import github from './routes/oauth/github.js';
import magic from './routes/magic.js';
import tokenRoutes from './routes/token.js';
import verifyRoutes from './routes/verify.js';
import health from './routes/health.js';
import subscription from './routes/subscription.js';
import admin from './routes/admin.js';
import session from './routes/session.js';
import minecraft from './routes/minecraft.js';

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>();

// Apply global middleware
app.use('*', securityHeaders);
app.use('*', corsMiddleware);

// Mount routes
app.route('/login', login);
app.route('/oauth/google', google);
app.route('/oauth/github', github);
app.route('/magic', magic);
app.route('/token', tokenRoutes);

// Verify routes - mount at root level for /verify, /userinfo, /logout
app.get('/verify', async (c) => {
  const response = await verifyRoutes.fetch(
    new Request(new URL('/', c.req.url).toString(), {
      method: 'GET',
      headers: c.req.raw.headers,
    }),
    c.env,
    c.executionCtx
  );
  return response;
});

app.get('/userinfo', async (c) => {
  const response = await verifyRoutes.fetch(
    new Request(new URL('/userinfo', c.req.url).toString(), {
      method: 'GET',
      headers: c.req.raw.headers,
    }),
    c.env,
    c.executionCtx
  );
  return response;
});

app.post('/logout', async (c) => {
  const response = await verifyRoutes.fetch(
    new Request(new URL('/logout', c.req.url).toString(), {
      method: 'POST',
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    }),
    c.env,
    c.executionCtx
  );
  return response;
});

app.route('/health', health);
app.route('/subscription', subscription);
app.route('/admin', admin);
app.route('/session', session);
app.route('/minecraft', minecraft);

// Root - show API info
app.get('/', (c) => {
  return c.json({
    service: 'GroveAuth',
    version: '1.0.0',
    description: 'Centralized authentication service for AutumnsGrove properties',
    documentation: 'https://github.com/AutumnsGrove/GroveAuth',
    endpoints: {
      login: 'GET /login',
      oauth: {
        google: 'GET /oauth/google',
        github: 'GET /oauth/github',
      },
      magic: {
        send: 'POST /magic/send',
        verify: 'POST /magic/verify',
      },
      token: {
        exchange: 'POST /token',
        refresh: 'POST /token/refresh',
        revoke: 'POST /token/revoke',
      },
      verify: 'GET /verify',
      userinfo: 'GET /userinfo',
      logout: 'POST /logout',
      health: 'GET /health',
      subscription: {
        get: 'GET /subscription',
        getByUserId: 'GET /subscription/:userId',
        canPost: 'GET /subscription/:userId/can-post',
        updatePostCount: 'POST /subscription/:userId/post-count',
        updateTier: 'PUT /subscription/:userId/tier',
      },
      admin: {
        stats: 'GET /admin/stats',
        users: 'GET /admin/users',
        auditLog: 'GET /admin/audit-log',
        clients: 'GET /admin/clients',
      },
      session: {
        check: 'GET /session/check',
      },
      minecraft: {
        status: 'GET /minecraft/status',
        start: 'POST /minecraft/start',
        stop: 'POST /minecraft/stop',
        whitelist: 'GET/POST /minecraft/whitelist',
        command: 'POST /minecraft/command',
        sync: 'POST /minecraft/sync',
        history: 'GET /minecraft/history',
      },
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'not_found', message: 'Endpoint not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'server_error', message: 'An unexpected error occurred' }, 500);
});

export default app;
