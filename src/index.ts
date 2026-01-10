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
import magic from './routes/magic.js';
import tokenRoutes from './routes/token.js';
import verifyRoutes from './routes/verify.js';
import health from './routes/health.js';
import subscription from './routes/subscription.js';
import admin from './routes/admin.js';
import session from './routes/session.js';
import minecraft from './routes/minecraft.js';
import cdn from './routes/cdn.js';
import betterAuth from './routes/betterAuth.js';
import settings from './routes/settings.js';

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>();

// Apply global middleware
app.use('*', securityHeaders);
app.use('*', corsMiddleware);

// Mount routes
app.route('/login', login);
app.route('/oauth/google', google);
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
app.route('/cdn', cdn);
app.route('/settings', settings);

// Better Auth routes (new auth system)
// Handles: /api/auth/sign-in/*, /api/auth/sign-out, /api/auth/session, etc.
app.route('/api/auth', betterAuth);

// Root - show API info
app.get('/', (c) => {
  return c.json({
    service: 'GroveAuth',
    version: '1.0.0',
    description: 'Centralized authentication service for AutumnsGrove properties',
    documentation: 'https://github.com/AutumnsGrove/GroveAuth',
    endpoints: {
      // Better Auth (new, recommended)
      betterAuth: {
        signInSocial: 'POST /api/auth/sign-in/social',
        signInMagicLink: 'POST /api/auth/sign-in/magic-link',
        signInPasskey: 'POST /api/auth/sign-in/passkey',
        signOut: 'POST /api/auth/sign-out',
        session: 'GET /api/auth/session',
        passkeyRegister: 'POST /api/auth/passkey/generate-register-options',
        passkeyVerify: 'POST /api/auth/passkey/verify-registration',
        passkeyList: 'GET /api/auth/passkey/list-user-passkeys',
        passkeyDelete: 'POST /api/auth/passkey/delete-passkey',
        twoFactorEnable: 'POST /api/auth/two-factor/enable',
        twoFactorVerify: 'POST /api/auth/two-factor/verify-totp',
        twoFactorDisable: 'POST /api/auth/two-factor/disable',
        twoFactorStatus: 'GET /api/auth/two-factor/get-status',
        callbackGoogle: 'GET /api/auth/callback/google',
        callbackDiscord: 'GET /api/auth/callback/discord',
      },
      // Account settings
      settings: 'GET /settings',
      // Legacy endpoints (maintained for backwards compatibility)
      login: 'GET /login',
      oauth: {
        google: 'GET /oauth/google',
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
        validate: 'POST /session/validate',
        revoke: 'POST /session/revoke',
        revokeAll: 'POST /session/revoke-all',
        list: 'GET /session/list',
        revokeById: 'DELETE /session/:sessionId',
        check: 'GET /session/check (legacy)',
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
      cdn: {
        upload: 'POST /cdn/upload',
        files: 'GET /cdn/files',
        folders: 'GET /cdn/folders',
        delete: 'DELETE /cdn/files/:id',
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

// Export SessionDO for Cloudflare Workers runtime
export { SessionDO } from './durables/SessionDO.js';

export default app;
