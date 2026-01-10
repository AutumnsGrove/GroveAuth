/**
 * Settings Routes - Account settings and passkey management
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { getSettingsPageHTML } from '../templates/settings.js';
import { createAuth } from '../auth/index.js';
import { createDbSession } from '../db/session.js';
import { getTwoFactorRequirementStatus } from '../db/queries.js';

const settings = new Hono<{ Bindings: Env }>();

/**
 * GET /settings - Display account settings page
 */
settings.get('/', async (c) => {
  const auth = createAuth(c.env);

  // Get current session
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    // Not authenticated - show login prompt
    return c.html(
      getSettingsPageHTML({
        authBaseUrl: c.env.AUTH_BASE_URL,
      })
    );
  }

  // Get 2FA requirement status
  const db = createDbSession(c.env);
  const twoFactorStatus = await getTwoFactorRequirementStatus(db, session.user.id);

  // Render settings page with user info and 2FA status
  return c.html(
    getSettingsPageHTML({
      authBaseUrl: c.env.AUTH_BASE_URL,
      user: {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email,
        image: session.user.image ?? null,
      },
      twoFactorRequirement: {
        required: twoFactorStatus.required,
        enabled: twoFactorStatus.enabled,
        exempt: twoFactorStatus.exempt,
        bypassUntil: twoFactorStatus.bypassUntil?.toISOString() || null,
        isCompliant: twoFactorStatus.isCompliant,
        tier: twoFactorStatus.tier,
      },
    })
  );
});

export default settings;
