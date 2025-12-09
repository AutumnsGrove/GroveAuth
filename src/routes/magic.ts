/**
 * Magic Code Routes - Email-based authentication
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { createDbSession } from '../db/session.js';
import {
  getClientByClientId,
  validateClientRedirectUri,
  isEmailAllowed,
  createMagicCode,
  getMagicCode,
  markMagicCodeUsed,
  createAuthCode,
  isAccountLocked,
  recordFailedAttempt,
  clearFailedAttempts,
  createAuditLog,
} from '../db/queries.js';
import { magicCodeSendSchema, magicCodeVerifySchema } from '../utils/validation.js';
import { generateMagicCode, generateAuthCode } from '../utils/crypto.js';
import { sendMagicCodeEmail } from '../services/email.js';
import { authenticateUser } from '../services/user.js';
import { getClientIP, getUserAgent } from '../middleware/security.js';
import { checkRouteRateLimit } from '../middleware/rateLimit.js';
import {
  MAGIC_CODE_EXPIRY,
  AUTH_CODE_EXPIRY,
  RATE_LIMIT_MAGIC_SEND_PER_EMAIL,
  RATE_LIMIT_MAGIC_SEND_PER_IP,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION,
} from '../utils/constants.js';

const magic = new Hono<{ Bindings: Env }>();

/**
 * POST /magic/send - Send magic code email
 */
magic.post('/send', async (c) => {
  const db = createDbSession(c.env);

  // Parse request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  // Validate request
  const result = magicCodeSendSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      { error: 'invalid_request', message: result.error.issues.map((e) => e.message).join(', ') },
      400
    );
  }

  const { email, client_id, redirect_uri } = result.data;

  // Check rate limits
  const ipRateLimit = await checkRouteRateLimit(
    db,
    'magic_ip',
    getClientIP(c.req.raw),
    RATE_LIMIT_MAGIC_SEND_PER_IP
  );
  if (!ipRateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: ipRateLimit.retryAfter },
      429
    );
  }

  const emailRateLimit = await checkRouteRateLimit(
    db,
    'magic_email',
    email.toLowerCase(),
    RATE_LIMIT_MAGIC_SEND_PER_EMAIL
  );
  if (!emailRateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', message: 'Too many requests. Please try again later.', retry_after: emailRateLimit.retryAfter },
      429
    );
  }

  // Validate client
  const client = await getClientByClientId(db, client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', message: 'Client not found' }, 400);
  }

  // Validate redirect URI
  const validRedirect = await validateClientRedirectUri(db, client_id, redirect_uri);
  if (!validRedirect) {
    return c.json({ error: 'invalid_request', message: 'Invalid redirect_uri' }, 400);
  }

  // Always return success to prevent email enumeration
  // But only actually send email if allowed
  const allowed = await isEmailAllowed(db, email);

  if (allowed) {
    // Check if account is locked
    const lockStatus = await isAccountLocked(db, email);
    if (!lockStatus.locked) {
      // Generate and store magic code
      const code = generateMagicCode();
      const expiresAt = new Date(Date.now() + MAGIC_CODE_EXPIRY * 1000).toISOString();

      await createMagicCode(db, {
        email: email,
        code: code,
        expires_at: expiresAt,
      });

      // Send email
      await sendMagicCodeEmail(c.env, email, code);

      // Log the event
      await createAuditLog(db, {
        event_type: 'magic_code_sent',
        client_id: client_id,
        ip_address: getClientIP(c.req.raw),
        user_agent: getUserAgent(c.req.raw),
        details: { email },
      });
    }
  }

  // Always return success message
  return c.json({
    success: true,
    message: 'If this email is registered, a code has been sent.',
  });
});

/**
 * POST /magic/verify - Verify magic code and get auth code
 */
magic.post('/verify', async (c) => {
  const db = createDbSession(c.env);

  // Parse request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  // Validate request
  const result = magicCodeVerifySchema.safeParse(body);
  if (!result.success) {
    return c.json(
      { error: 'invalid_request', message: result.error.issues.map((e) => e.message).join(', ') },
      400
    );
  }

  const { email, code, client_id, redirect_uri, state } = result.data;

  // Validate client
  const client = await getClientByClientId(db, client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', message: 'Client not found' }, 400);
  }

  // Validate redirect URI
  const validRedirect = await validateClientRedirectUri(db, client_id, redirect_uri);
  if (!validRedirect) {
    return c.json({ error: 'invalid_request', message: 'Invalid redirect_uri' }, 400);
  }

  // Check if account is locked
  const lockStatus = await isAccountLocked(db, email);
  if (lockStatus.locked) {
    return c.json(
      {
        error: 'account_locked',
        message: 'Too many failed attempts. Try again later.',
        locked_until: lockStatus.lockedUntil?.toISOString(),
      },
      423
    );
  }

  // Verify magic code
  const magicCode = await getMagicCode(db, email, code);

  if (!magicCode) {
    // Record failed attempt
    const failResult = await recordFailedAttempt(db, email, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION);

    if (failResult.locked) {
      return c.json(
        {
          error: 'account_locked',
          message: 'Too many failed attempts. Try again in 15 minutes.',
          locked_until: failResult.lockedUntil?.toISOString(),
        },
        423
      );
    }

    return c.json({ error: 'invalid_code', message: 'Invalid or expired code' }, 401);
  }

  // Mark code as used
  await markMagicCodeUsed(db, magicCode.id);

  // Clear failed attempts on success
  await clearFailedAttempts(db, email);

  // Authenticate user (checks allowlist, creates/updates user)
  const user = await authenticateUser(
    db,
    {
      email: email,
      name: null,
      avatar_url: null,
      provider: 'magic_code',
      provider_id: null,
    },
    {
      client_id: client_id,
      ip_address: getClientIP(c.req.raw),
      user_agent: getUserAgent(c.req.raw),
    }
  );

  if (!user) {
    return c.json({ error: 'access_denied', message: 'Email not authorized' }, 403);
  }

  // Generate authorization code for the client
  const authCode = generateAuthCode();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY * 1000).toISOString();

  await createAuthCode(db, {
    code: authCode,
    client_id: client_id,
    user_id: user.id,
    redirect_uri: redirect_uri,
    expires_at: expiresAt,
  });

  // Log the verification
  await createAuditLog(db, {
    event_type: 'magic_code_verified',
    user_id: user.id,
    client_id: client_id,
    ip_address: getClientIP(c.req.raw),
    user_agent: getUserAgent(c.req.raw),
  });

  // Return redirect URL with auth code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', authCode);
  redirectUrl.searchParams.set('state', state);

  return c.json({
    success: true,
    redirect_uri: redirectUrl.toString(),
  });
});

export default magic;
