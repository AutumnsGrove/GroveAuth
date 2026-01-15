/**
 * Google OAuth Routes
 */

import { Hono } from 'hono';
import type { Env } from '../../types.js';
import { createDbSession } from '../../db/session.js';
import {
  getClientByClientId,
  validateClientRedirectUri,
  saveOAuthState,
  getOAuthState,
  deleteOAuthState,
  createAuthCode,
} from '../../db/queries.js';
import { loginParamsSchema } from '../../utils/validation.js';
import { generateRandomString, generateAuthCode } from '../../utils/crypto.js';
import { getGoogleAuthUrl, exchangeGoogleCode, getGoogleUserInfo } from '../../services/oauth.js';
import { authenticateUser } from '../../services/user.js';
import { getClientIP, getUserAgent } from '../../middleware/security.js';
import { AUTH_CODE_EXPIRY } from '../../utils/constants.js';
import {
  getDeviceId,
  parseDeviceName,
  createSessionCookieHeader,
  getClientIP as getSessionClientIP,
  getUserAgent as getSessionUserAgent,
} from '../../lib/session.js';
import type { SessionDO } from '../../durables/SessionDO.js';

const google = new Hono<{ Bindings: Env }>();

/**
 * GET /oauth/google - Initiate Google OAuth flow
 */
google.get('/', async (c) => {
  const db = createDbSession(c.env);

  // Parse and validate query parameters
  const params = {
    client_id: c.req.query('client_id'),
    redirect_uri: c.req.query('redirect_uri'),
    state: c.req.query('state'),
    code_challenge: c.req.query('code_challenge'),
    code_challenge_method: c.req.query('code_challenge_method'),
  };

  const result = loginParamsSchema.safeParse(params);

  if (!result.success) {
    return c.json({ error: 'invalid_request', error_description: 'Missing required parameters' }, 400);
  }

  const validParams = result.data;

  // Validate client
  const client = await getClientByClientId(db, validParams.client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Client not found' }, 400);
  }

  // Validate redirect URI
  const validRedirect = await validateClientRedirectUri(
    db,
    validParams.client_id,
    validParams.redirect_uri
  );
  if (!validRedirect) {
    return c.json({ error: 'invalid_request', error_description: 'Invalid redirect_uri' }, 400);
  }

  // Generate internal state for Google OAuth
  const internalState = generateRandomString(32);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  // Save OAuth state
  await saveOAuthState(db, {
    state: internalState,
    client_id: validParams.client_id,
    redirect_uri: validParams.redirect_uri,
    code_challenge: validParams.code_challenge,
    code_challenge_method: validParams.code_challenge_method,
    original_state: validParams.state,
    expires_at: expiresAt,
  });

  // Build Google OAuth URL
  const callbackUrl = `${c.env.AUTH_BASE_URL}/oauth/google/callback`;
  const googleAuthUrl = getGoogleAuthUrl(c.env, internalState, callbackUrl);

  return c.redirect(googleAuthUrl);
});

/**
 * GET /oauth/google/callback - Handle Google OAuth callback
 */
google.get('/callback', async (c) => {
  const db = createDbSession(c.env);

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  // Check for errors from Google
  if (error) {
    // We don't have the original redirect URI, return generic error
    return c.json({ error: 'access_denied', error_description: error }, 400);
  }

  if (!code || !state) {
    return c.json({ error: 'invalid_request', error_description: 'Missing code or state' }, 400);
  }

  // Get saved OAuth state
  const savedState = await getOAuthState(db, state);
  if (!savedState) {
    return c.json({ error: 'invalid_state', error_description: 'State not found or expired' }, 400);
  }

  // Delete used state
  await deleteOAuthState(db, state);

  // Exchange code for tokens
  const callbackUrl = `${c.env.AUTH_BASE_URL}/oauth/google/callback`;
  const tokens = await exchangeGoogleCode(c.env, code, callbackUrl);

  if (!tokens) {
    const errorRedirect = buildErrorRedirect(
      savedState.redirect_uri,
      'server_error',
      'Failed to exchange code for tokens',
      savedState.state
    );
    return c.redirect(errorRedirect);
  }

  // Get user info from Google
  const googleUser = await getGoogleUserInfo(tokens.access_token);

  if (!googleUser || !googleUser.email) {
    const errorRedirect = buildErrorRedirect(
      savedState.redirect_uri,
      'server_error',
      'Failed to get user info from Google',
      savedState.state
    );
    return c.redirect(errorRedirect);
  }

  // Authenticate user (checks allowlist unless public signup is enabled)
  const user = await authenticateUser(
    db,
    {
      email: googleUser.email,
      name: googleUser.name || null,
      avatar_url: googleUser.picture || null,
      provider: 'google',
      provider_id: googleUser.id,
    },
    {
      client_id: savedState.client_id,
      ip_address: getClientIP(c.req.raw),
      user_agent: getUserAgent(c.req.raw),
      publicSignupEnabled: c.env.PUBLIC_SIGNUP_ENABLED === 'true',
    }
  );

  if (!user) {
    const errorRedirect = buildErrorRedirect(
      savedState.redirect_uri,
      'access_denied',
      'Email not authorized',
      savedState.state
    );
    return c.redirect(errorRedirect);
  }

  // Create session in SessionDO
  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${user.id}`)
  ) as DurableObjectStub<SessionDO>;

  const deviceId = await getDeviceId(c.req.raw, c.env.SESSION_SECRET);
  const userAgent = getSessionUserAgent(c.req.raw);
  const deviceName = parseDeviceName(userAgent);
  const ipAddress = getSessionClientIP(c.req.raw);

  const { sessionId } = await sessionDO.createSession({
    deviceId,
    deviceName,
    ipAddress,
    userAgent,
    expiresInSeconds: 7 * 24 * 60 * 60, // 7 days
  });

  // Generate session cookie header
  const sessionCookieHeader = await createSessionCookieHeader(
    sessionId,
    user.id,
    c.env.SESSION_SECRET
  );

  // Check if this is an internal service (like Mycelium)
  // Internal services use session cookie for authentication
  const client = await getClientByClientId(db, savedState.client_id);
  if (client?.is_internal_service) {
    const redirect = buildInternalServiceRedirect(
      savedState.redirect_uri,
      savedState.state
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirect,
        'Set-Cookie': sessionCookieHeader,
      },
    });
  }

  // Generate authorization code for the client (standard OAuth flow)
  const authCode = generateAuthCode();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY * 1000).toISOString();

  await createAuthCode(db, {
    code: authCode,
    client_id: savedState.client_id,
    user_id: user.id,
    redirect_uri: savedState.redirect_uri,
    code_challenge: savedState.code_challenge,
    code_challenge_method: savedState.code_challenge_method,
    expires_at: expiresAt,
  });

  // Redirect back to client with auth code and session cookie
  const successRedirect = buildSuccessRedirect(savedState.redirect_uri, authCode, savedState.state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: successRedirect,
      'Set-Cookie': sessionCookieHeader,
    },
  });
});

function buildSuccessRedirect(redirectUri: string, code: string, state: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);
  return url.toString();
}

function buildErrorRedirect(
  redirectUri: string,
  error: string,
  errorDescription: string,
  state: string
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', errorDescription);
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Build redirect URL for internal Grove services
 * Session cookie handles authentication - no need for URL tokens
 */
function buildInternalServiceRedirect(
  redirectUri: string,
  state: string
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('state', state);
  // Session cookie handles authentication - no need for URL tokens
  return url.toString();
}

export default google;
