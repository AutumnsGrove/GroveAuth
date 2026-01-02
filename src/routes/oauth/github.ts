/**
 * GitHub OAuth Routes
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
import {
  getGitHubAuthUrl,
  exchangeGitHubCode,
  getGitHubUserInfo,
  getGitHubPrimaryEmail,
} from '../../services/oauth.js';
import { authenticateUser } from '../../services/user.js';
import { getClientIP, getUserAgent } from '../../middleware/security.js';
import { AUTH_CODE_EXPIRY } from '../../utils/constants.js';
import {
  getDeviceId,
  parseDeviceName,
  createSessionCookieHeader,
  createSessionCookie,
  getClientIP as getSessionClientIP,
  getUserAgent as getSessionUserAgent,
} from '../../lib/session.js';
import type { SessionDO } from '../../durables/SessionDO.js';

const github = new Hono<{ Bindings: Env }>();

/**
 * GET /oauth/github - Initiate GitHub OAuth flow
 */
github.get('/', async (c) => {
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

  // Generate internal state for GitHub OAuth
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

  // Build GitHub OAuth URL
  const callbackUrl = `${c.env.AUTH_BASE_URL}/oauth/github/callback`;
  const githubAuthUrl = getGitHubAuthUrl(c.env, internalState, callbackUrl);

  return c.redirect(githubAuthUrl);
});

/**
 * GET /oauth/github/callback - Handle GitHub OAuth callback
 */
github.get('/callback', async (c) => {
  const db = createDbSession(c.env);

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  // Check for errors from GitHub
  if (error) {
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
  const tokens = await exchangeGitHubCode(c.env, code);

  if (!tokens) {
    const errorRedirect = buildErrorRedirect(
      savedState.redirect_uri,
      'server_error',
      'Failed to exchange code for tokens',
      savedState.state
    );
    return c.redirect(errorRedirect);
  }

  // Get user info from GitHub
  const githubUser = await getGitHubUserInfo(tokens.access_token);

  if (!githubUser) {
    const errorRedirect = buildErrorRedirect(
      savedState.redirect_uri,
      'server_error',
      'Failed to get user info from GitHub',
      savedState.state
    );
    return c.redirect(errorRedirect);
  }

  // Get primary email (GitHub may not include it in user info)
  let email = githubUser.email;
  if (!email) {
    email = await getGitHubPrimaryEmail(tokens.access_token);
  }

  if (!email) {
    const errorRedirect = buildErrorRedirect(
      savedState.redirect_uri,
      'server_error',
      'Could not retrieve email from GitHub',
      savedState.state
    );
    return c.redirect(errorRedirect);
  }

  // Authenticate user (checks allowlist, creates/updates user)
  const user = await authenticateUser(
    db,
    {
      email: email,
      name: githubUser.name || githubUser.login,
      avatar_url: githubUser.avatar_url || null,
      provider: 'github',
      provider_id: String(githubUser.id),
    },
    {
      client_id: savedState.client_id,
      ip_address: getClientIP(c.req.raw),
      user_agent: getUserAgent(c.req.raw),
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
    expiresInSeconds: 30 * 24 * 60 * 60, // 30 days
  });

  // Generate session cookie header
  const sessionCookieHeader = await createSessionCookieHeader(
    sessionId,
    user.id,
    c.env.SESSION_SECRET
  );

  // Check if this is an internal service (like Mycelium)
  // Internal services get session tokens instead of auth codes
  const client = await getClientByClientId(db, savedState.client_id);
  if (client?.is_internal_service) {
    const sessionToken = await createSessionCookie(sessionId, user.id, c.env.SESSION_SECRET);
    const redirect = buildInternalServiceRedirect(
      savedState.redirect_uri,
      sessionToken,
      user.id,
      user.email,
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
 * Returns session token + user info instead of auth code
 */
function buildInternalServiceRedirect(
  redirectUri: string,
  sessionToken: string,
  userId: string,
  email: string,
  state: string
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('user_id', userId);
  url.searchParams.set('email', email);
  url.searchParams.set('state', state);
  return url.toString();
}

export default github;
