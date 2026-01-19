/**
 * Device Authorization Routes (RFC 8628)
 *
 * Implements OAuth 2.0 Device Authorization Grant for CLI/device authentication.
 * Users initiate auth from CLI, then approve in browser while logged in.
 *
 * Endpoints:
 * - POST /auth/device-code - Generate device/user codes (called by CLI)
 * - GET /auth/device - Authorization UI page (user visits this)
 * - POST /auth/device/authorize - User approves/denies (from UI)
 */

import { Hono } from 'hono';
import type { Env, DeviceCodeResponse } from '../types.js';
import {
  getClientByClientId,
  createDeviceCode,
  getDeviceCodeByUserCode,
  authorizeDeviceCode,
  denyDeviceCode,
  isUserCodeUnique,
  createAuditLog,
  isEmailAllowed,
  cleanupExpiredDeviceCodes,
  getUserById,
} from '../db/queries.js';
import { createDbSession } from '../db/session.js';
import { getSessionFromRequest } from '../lib/session.js';
import {
  generateDeviceCode,
  generateUserCode,
  hashSecret,
} from '../utils/crypto.js';
import { deviceCodeInitSchema, deviceAuthorizeSchema } from '../utils/validation.js';
import { getClientIP, getUserAgent } from '../middleware/security.js';
import { checkRouteRateLimit } from '../middleware/rateLimit.js';
import {
  DEVICE_CODE_EXPIRY,
  DEVICE_CODE_POLL_INTERVAL,
  DEVICE_CODE_CHARS,
  USER_CODE_LENGTH,
  RATE_LIMIT_DEVICE_INIT,
} from '../utils/constants.js';
import { getDeviceAuthorizationPageHTML } from '../templates/device.js';

const device = new Hono<{ Bindings: Env }>();

/**
 * POST /auth/device-code - Device Authorization Request
 *
 * Called by CLI to initiate the device flow.
 * Returns device_code (for polling) and user_code (for user to enter).
 */
device.post('/device-code', async (c) => {
  const db = createDbSession(c.env);

  // Rate limit by IP
  const clientIP = getClientIP(c.req.raw) || 'unknown';
  const rateLimit = await checkRouteRateLimit(db, 'device_init', clientIP, RATE_LIMIT_DEVICE_INIT);
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'slow_down', error_description: 'Too many requests', retry_after: rateLimit.retryAfter },
      429
    );
  }

  // Parse and validate request body
  let body: { client_id: string; scope?: string };
  try {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else {
      // URL-encoded form data
      const formData = await c.req.text();
      const params = new URLSearchParams(formData);
      body = {
        client_id: params.get('client_id') || '',
        scope: params.get('scope') || undefined,
      };
    }
  } catch {
    return c.json({ error: 'invalid_request', error_description: 'Invalid request body' }, 400);
  }

  const parsed = deviceCodeInitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'invalid_request', error_description: parsed.error.issues[0].message },
      400
    );
  }

  const { client_id, scope } = parsed.data;

  // Validate client exists
  const client = await getClientByClientId(db, client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Client not found' }, 401);
  }

  // Generate unique user code (retry if collision)
  let userCode: string;
  let attempts = 0;
  const maxAttempts = 5;
  do {
    userCode = generateUserCode(DEVICE_CODE_CHARS, USER_CODE_LENGTH);
    attempts++;
  } while (!(await isUserCodeUnique(db, userCode)) && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    return c.json(
      { error: 'server_error', error_description: 'Failed to generate unique code' },
      500
    );
  }

  // Generate device code and hash it for storage
  const deviceCodeRaw = generateDeviceCode();
  const deviceCodeHash = await hashSecret(deviceCodeRaw);

  // Calculate expiration
  const expiresAt = Math.floor(Date.now() / 1000) + DEVICE_CODE_EXPIRY;

  // Store device code
  await createDeviceCode(db, {
    device_code_hash: deviceCodeHash,
    user_code: userCode,
    client_id,
    scope,
    expires_at: expiresAt,
    interval: DEVICE_CODE_POLL_INTERVAL,
  });

  // Log creation
  await createAuditLog(db, {
    event_type: 'device_code_created',
    client_id,
    ip_address: clientIP,
    user_agent: getUserAgent(c.req.raw),
    details: { user_code: userCode },
  });

  // Cleanup expired codes opportunistically
  c.executionCtx.waitUntil(cleanupExpiredDeviceCodes(db));

  // Build verification URIs
  const verificationUri = `${c.env.AUTH_BASE_URL}/auth/device`;
  const verificationUriComplete = `${verificationUri}?user_code=${encodeURIComponent(userCode)}`;

  const response: DeviceCodeResponse = {
    device_code: deviceCodeRaw,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: verificationUriComplete,
    expires_in: DEVICE_CODE_EXPIRY,
    interval: DEVICE_CODE_POLL_INTERVAL,
  };

  return c.json(response);
});

/**
 * GET /auth/device - Device Authorization Page
 *
 * User visits this page to enter the user_code and approve/deny.
 * Requires authenticated session (grove_session cookie from Google OAuth).
 */
device.get('/device', async (c) => {
  const db = createDbSession(c.env);

  // Get user_code from query params or from state (after OAuth redirect)
  let userCodeParam = c.req.query('user_code');
  const stateParam = c.req.query('state');

  // After OAuth redirect, user_code might be encoded in state
  if (!userCodeParam && stateParam) {
    try {
      const stateUrl = new URL(decodeURIComponent(stateParam));
      userCodeParam = stateUrl.searchParams.get('user_code') || undefined;
    } catch {
      // State wasn't a URL, ignore
    }
  }

  // Get session from grove_session cookie (set by Google OAuth flow)
  const parsedSession = await getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);

  if (!parsedSession) {
    // Not logged in - redirect to login
    // Build return URL using AUTH_BASE_URL (not c.req.url) to avoid domain issues
    const returnUrl = userCodeParam
      ? `${c.env.AUTH_BASE_URL}/auth/device?user_code=${encodeURIComponent(userCodeParam)}`
      : `${c.env.AUTH_BASE_URL}/auth/device`;
    const loginUrl = `${c.env.AUTH_BASE_URL}/login?client_id=grove-cli&redirect_uri=${encodeURIComponent(c.env.AUTH_BASE_URL + '/auth/device')}&state=${encodeURIComponent(returnUrl)}`;
    return c.redirect(loginUrl);
  }

  // Look up the user from the session
  const user = await getUserById(db, parsedSession.userId);
  if (!user) {
    // Session references a user that doesn't exist - clear and redirect to login
    const returnUrl = userCodeParam
      ? `${c.env.AUTH_BASE_URL}/auth/device?user_code=${encodeURIComponent(userCodeParam)}`
      : `${c.env.AUTH_BASE_URL}/auth/device`;
    const loginUrl = `${c.env.AUTH_BASE_URL}/login?client_id=grove-cli&redirect_uri=${encodeURIComponent(c.env.AUTH_BASE_URL + '/auth/device')}&state=${encodeURIComponent(returnUrl)}`;
    return c.redirect(loginUrl);
  }

  // Check for success state from redirect
  const successParam = c.req.query('success') as 'approved' | 'denied' | null;
  let deviceCode = null;
  let error = null;

  if (userCodeParam && !successParam) {
    deviceCode = await getDeviceCodeByUserCode(db, userCodeParam);
    if (!deviceCode) {
      error = 'Invalid or expired code';
    } else {
      const now = Math.floor(Date.now() / 1000);
      if (deviceCode.expires_at < now) {
        error = 'This code has expired';
        deviceCode = null;
      } else if (deviceCode.status !== 'pending') {
        error = `This code has already been ${deviceCode.status}`;
        deviceCode = null;
      }
    }
  }

  // Get client name for display
  let clientName = 'Grove CLI';
  if (deviceCode) {
    const client = await getClientByClientId(db, deviceCode.client_id);
    if (client) {
      clientName = client.name;
    }
  }

  const html = getDeviceAuthorizationPageHTML({
    userCode: userCodeParam || '',
    clientName,
    userName: user.name || user.email,
    error,
    showForm: !!deviceCode,
    authBaseUrl: c.env.AUTH_BASE_URL,
    success: successParam,
  });

  return c.html(html);
});

/**
 * POST /auth/device/authorize - Authorize or Deny Device Code
 *
 * Called when user clicks Approve or Deny on the authorization page.
 * Requires authenticated session.
 */
device.post('/device/authorize', async (c) => {
  const db = createDbSession(c.env);

  // Get session from grove_session cookie (set by Google OAuth flow)
  const parsedSession = await getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);

  if (!parsedSession) {
    return c.json({ error: 'unauthorized', error_description: 'Authentication required' }, 401);
  }

  // Look up the user from the session
  const user = await getUserById(db, parsedSession.userId);
  if (!user) {
    return c.json({ error: 'unauthorized', error_description: 'User not found' }, 401);
  }

  // Parse request body
  let body: { user_code: string; action: 'approve' | 'deny' };
  try {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else {
      const formData = await c.req.text();
      const params = new URLSearchParams(formData);
      body = {
        user_code: params.get('user_code') || '',
        action: (params.get('action') as 'approve' | 'deny') || 'deny',
      };
    }
  } catch {
    return c.json({ error: 'invalid_request', error_description: 'Invalid request body' }, 400);
  }

  const parsed = deviceAuthorizeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'invalid_request', error_description: parsed.error.issues[0].message },
      400
    );
  }

  const { user_code, action } = parsed.data;

  // Get device code
  const deviceCode = await getDeviceCodeByUserCode(db, user_code);
  if (!deviceCode) {
    return c.json({ error: 'invalid_grant', error_description: 'Invalid or expired code' }, 400);
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (deviceCode.expires_at < now) {
    return c.json({ error: 'expired_token', error_description: 'Code has expired' }, 400);
  }

  // Check status
  if (deviceCode.status !== 'pending') {
    return c.json(
      { error: 'invalid_grant', error_description: `Code already ${deviceCode.status}` },
      400
    );
  }

  // Check if user's email is allowed (for allowlist enforcement)
  const publicSignupEnabled = c.env.PUBLIC_SIGNUP_ENABLED === 'true';
  const allowed = await isEmailAllowed(db, user.email, publicSignupEnabled);
  if (!allowed) {
    return c.json(
      { error: 'access_denied', error_description: 'Your account is not authorized for this action' },
      403
    );
  }

  const clientIP = getClientIP(c.req.raw);
  const userAgent = getUserAgent(c.req.raw);

  if (action === 'approve') {
    // Authorize the device code
    await authorizeDeviceCode(db, deviceCode.id, user.id);

    await createAuditLog(db, {
      event_type: 'device_code_authorized',
      user_id: user.id,
      client_id: deviceCode.client_id,
      ip_address: clientIP,
      user_agent: userAgent,
      details: { user_code },
    });

    // For HTML form submission, redirect to success page
    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('application/json')) {
      return c.redirect(`${c.env.AUTH_BASE_URL}/auth/device?success=approved`);
    }

    return c.json({ success: true, message: 'Device authorized successfully' });
  } else {
    // Deny the device code
    await denyDeviceCode(db, deviceCode.id);

    await createAuditLog(db, {
      event_type: 'device_code_denied',
      user_id: user.id,
      client_id: deviceCode.client_id,
      ip_address: clientIP,
      user_agent: userAgent,
      details: { user_code },
    });

    // For HTML form submission, redirect to denied page
    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('application/json')) {
      return c.redirect(`${c.env.AUTH_BASE_URL}/auth/device?success=denied`);
    }

    return c.json({ success: true, message: 'Device authorization denied' });
  }
});

export default device;
