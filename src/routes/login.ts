/**
 * Login Routes - Login page and provider selection
 */

import { Hono } from 'hono';
import type { Env, LoginParams } from '../types.js';
import { getClientByClientId, validateClientRedirectUri } from '../db/queries.js';
import { createDbSession } from '../db/session.js';
import { loginParamsSchema } from '../utils/validation.js';
import { getLoginPageHTML } from '../templates/login.js';

const login = new Hono<{ Bindings: Env }>();

/**
 * GET /login - Display login page with provider selection
 */
login.get('/', async (c) => {
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
    return c.html(
      getLoginPageHTML({
        error: 'Missing or invalid parameters',
        errorDescription: result.error.issues.map((e) => e.message).join(', '),
      }),
      400
    );
  }

  const validParams = result.data as LoginParams;

  // Validate client_id exists
  const client = await getClientByClientId(db, validParams.client_id);
  if (!client) {
    return c.html(
      getLoginPageHTML({
        error: 'Invalid client',
        errorDescription: 'The client_id provided is not registered.',
      }),
      400
    );
  }

  // Validate redirect_uri is registered for this client
  const validRedirect = await validateClientRedirectUri(
    db,
    validParams.client_id,
    validParams.redirect_uri
  );
  if (!validRedirect) {
    return c.html(
      getLoginPageHTML({
        error: 'Invalid redirect URI',
        errorDescription: 'The redirect_uri is not registered for this client.',
      }),
      400
    );
  }

  // Render login page with valid parameters
  return c.html(
    getLoginPageHTML({
      clientName: client.name,
      params: validParams,
      authBaseUrl: c.env.AUTH_BASE_URL,
    })
  );
});

export default login;
