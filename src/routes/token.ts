/**
 * Token Routes - Token exchange, refresh, and revocation
 */

import { Hono, type Context } from 'hono';
import type { Env, TokenResponse } from '../types.js';
import {
  getClientByClientId,
  getAuthCode,
  markAuthCodeUsed,
  getUserById,
  createRefreshToken,
  getRefreshTokenByHash,
  revokeRefreshToken,
} from '../db/queries.js';
import { parseFormData } from '../utils/validation.js';
import {
  generateRefreshToken,
  hashSecret,
  verifySecret,
  verifyCodeChallenge,
} from '../utils/crypto.js';
import { createAccessToken } from '../services/jwt.js';
import { logTokenExchange, logTokenRefresh, logTokenRevoke } from '../services/user.js';
import { getClientIP, getUserAgent } from '../middleware/security.js';
import { checkRouteRateLimit } from '../middleware/rateLimit.js';
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  RATE_LIMIT_TOKEN_PER_CLIENT,
} from '../utils/constants.js';

const token = new Hono<{ Bindings: Env }>();

/**
 * POST /token - Exchange authorization code for tokens
 */
token.post('/', async (c) => {
  // Parse form data
  const bodyText = await c.req.text();
  const params = parseFormData(bodyText);

  const grantType = params.grant_type;

  // Route to appropriate handler based on grant type
  if (grantType === 'authorization_code') {
    return handleAuthorizationCodeGrant(c, params);
  } else if (grantType === 'refresh_token') {
    return handleRefreshTokenGrant(c, params);
  } else {
    return c.json(
      { error: 'unsupported_grant_type', error_description: 'Grant type not supported' },
      400
    );
  }
});

/**
 * POST /token/refresh - Refresh access token (alias for grant_type=refresh_token)
 */
token.post('/refresh', async (c) => {
  const bodyText = await c.req.text();
  const params = parseFormData(bodyText);
  params.grant_type = 'refresh_token';
  return handleRefreshTokenGrant(c, params);
});

/**
 * POST /token/revoke - Revoke a refresh token
 */
token.post('/revoke', async (c) => {
  const bodyText = await c.req.text();
  const params = parseFormData(bodyText);

  const { token: tokenValue, client_id, client_secret } = params;

  if (!tokenValue || !client_id || !client_secret) {
    return c.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      400
    );
  }

  // Validate client credentials
  const client = await getClientByClientId(c.env.DB, client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Client not found' }, 401);
  }

  const secretValid = await verifySecret(client_secret, client.client_secret_hash);
  if (!secretValid) {
    return c.json({ error: 'invalid_client', error_description: 'Invalid client credentials' }, 401);
  }

  // Revoke the token
  const tokenHash = await hashSecret(tokenValue);
  const existingToken = await getRefreshTokenByHash(c.env.DB, tokenHash);

  if (existingToken) {
    await revokeRefreshToken(c.env.DB, tokenHash);

    // Log the revocation
    await logTokenRevoke(c.env.DB, existingToken.user_id, {
      client_id,
      ip_address: getClientIP(c.req.raw),
      user_agent: getUserAgent(c.req.raw),
    });
  }

  // Always return success per RFC 7009
  return c.json({ success: true });
});

/**
 * Handle authorization_code grant type
 */
async function handleAuthorizationCodeGrant(
  c: Context<{ Bindings: Env }>,
  params: Record<string, string>
) {
  const { code, redirect_uri, client_id, client_secret, code_verifier } = params;

  if (!code || !redirect_uri || !client_id || !client_secret) {
    return c.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      400
    );
  }

  // Rate limit check
  const rateLimit = await checkRouteRateLimit(c, 'token', client_id, RATE_LIMIT_TOKEN_PER_CLIENT);
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', error_description: 'Too many requests', retry_after: rateLimit.retryAfter },
      429
    );
  }

  // Validate client credentials
  const client = await getClientByClientId(c.env.DB, client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Client not found' }, 401);
  }

  const secretValid = await verifySecret(client_secret, client.client_secret_hash);
  if (!secretValid) {
    return c.json({ error: 'invalid_client', error_description: 'Invalid client credentials' }, 401);
  }

  // Get and validate auth code
  const authCode = await getAuthCode(c.env.DB, code);

  if (!authCode) {
    return c.json({ error: 'invalid_grant', error_description: 'Authorization code not found' }, 400);
  }

  if (authCode.used) {
    return c.json({ error: 'invalid_grant', error_description: 'Authorization code already used' }, 400);
  }

  if (new Date(authCode.expires_at) < new Date()) {
    return c.json({ error: 'invalid_grant', error_description: 'Authorization code expired' }, 400);
  }

  if (authCode.client_id !== client_id) {
    return c.json({ error: 'invalid_grant', error_description: 'Client mismatch' }, 400);
  }

  if (authCode.redirect_uri !== redirect_uri) {
    return c.json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }, 400);
  }

  // Verify PKCE if code challenge was used
  if (authCode.code_challenge) {
    if (!code_verifier) {
      return c.json({ error: 'invalid_grant', error_description: 'Code verifier required' }, 400);
    }

    const valid = await verifyCodeChallenge(
      code_verifier,
      authCode.code_challenge,
      authCode.code_challenge_method || 'S256'
    );

    if (!valid) {
      return c.json({ error: 'invalid_grant', error_description: 'Invalid code verifier' }, 400);
    }
  }

  // Mark auth code as used
  await markAuthCodeUsed(c.env.DB, code);

  // Get user
  const user = await getUserById(c.env.DB, authCode.user_id);
  if (!user) {
    return c.json({ error: 'invalid_grant', error_description: 'User not found' }, 400);
  }

  // Generate tokens
  const accessToken = await createAccessToken(c.env, user, client_id);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashSecret(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000).toISOString();

  await createRefreshToken(c.env.DB, {
    token_hash: refreshTokenHash,
    user_id: user.id,
    client_id: client_id,
    expires_at: refreshExpiresAt,
  });

  // Log the exchange
  await logTokenExchange(c.env.DB, user.id, {
    client_id,
    ip_address: getClientIP(c.req.raw),
    user_agent: getUserAgent(c.req.raw),
  });

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_EXPIRY,
    refresh_token: refreshToken,
    scope: 'openid email profile',
  };

  return c.json(response);
}

/**
 * Handle refresh_token grant type
 */
async function handleRefreshTokenGrant(
  c: Context<{ Bindings: Env }>,
  params: Record<string, string>
) {
  const { refresh_token, client_id, client_secret } = params;

  if (!refresh_token || !client_id || !client_secret) {
    return c.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      400
    );
  }

  // Rate limit check
  const rateLimit = await checkRouteRateLimit(c, 'token', client_id, RATE_LIMIT_TOKEN_PER_CLIENT);
  if (!rateLimit.allowed) {
    return c.json(
      { error: 'rate_limit', error_description: 'Too many requests', retry_after: rateLimit.retryAfter },
      429
    );
  }

  // Validate client credentials
  const client = await getClientByClientId(c.env.DB, client_id);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Client not found' }, 401);
  }

  const secretValid = await verifySecret(client_secret, client.client_secret_hash);
  if (!secretValid) {
    return c.json({ error: 'invalid_client', error_description: 'Invalid client credentials' }, 401);
  }

  // Validate refresh token
  const tokenHash = await hashSecret(refresh_token);
  const existingToken = await getRefreshTokenByHash(c.env.DB, tokenHash);

  if (!existingToken) {
    return c.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
  }

  if (existingToken.client_id !== client_id) {
    return c.json({ error: 'invalid_grant', error_description: 'Client mismatch' }, 400);
  }

  if (new Date(existingToken.expires_at) < new Date()) {
    return c.json({ error: 'invalid_grant', error_description: 'Refresh token expired' }, 400);
  }

  // Revoke old refresh token (rotation)
  await revokeRefreshToken(c.env.DB, tokenHash);

  // Get user
  const user = await getUserById(c.env.DB, existingToken.user_id);
  if (!user) {
    return c.json({ error: 'invalid_grant', error_description: 'User not found' }, 400);
  }

  // Generate new tokens
  const accessToken = await createAccessToken(c.env, user, client_id);
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = await hashSecret(newRefreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000).toISOString();

  await createRefreshToken(c.env.DB, {
    token_hash: newRefreshTokenHash,
    user_id: user.id,
    client_id: client_id,
    expires_at: refreshExpiresAt,
  });

  // Log the refresh
  await logTokenRefresh(c.env.DB, user.id, {
    client_id,
    ip_address: getClientIP(c.req.raw),
    user_agent: getUserAgent(c.req.raw),
  });

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_EXPIRY,
    refresh_token: newRefreshToken,
    scope: 'openid email profile',
  };

  return c.json(response);
}

export default token;
