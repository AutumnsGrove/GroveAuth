/**
 * Better Auth Configuration for Heartwood
 *
 * This configuration integrates Better Auth with Cloudflare's D1 and KV,
 * providing OAuth (Google), magic link, and passkey authentication.
 *
 * Grove-specific features:
 * - Email allowlist enforcement (admin-only access)
 * - Extended user schema with tenantId, isAdmin, banned, etc.
 * - Cross-subdomain session cookie (.grove.place)
 * - Rate limiting via Grove's Threshold pattern (not Better Auth's built-in)
 */

import { betterAuth } from 'better-auth';
import { withCloudflare } from 'better-auth-cloudflare';
import { magicLink, twoFactor } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../types.js';
import { isEmailAllowed } from '../db/queries.js';
import { createDbSession } from '../db/session.js';

// Email template for magic link
const MAGIC_LINK_EMAIL_HTML = (url: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heartwood Login</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
            Heartwood
          </h1>

          <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46; line-height: 1.5;">
            Click the button below to sign in. This link will expire in 10 minutes.
          </p>

          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${url}" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Sign In to Heartwood
            </a>
          </div>

          <p style="margin: 0 0 8px; font-size: 14px; color: #71717a; line-height: 1.5;">
            If you didn't request this link, you can safely ignore this email.
          </p>

          <p style="margin: 0; font-size: 12px; color: #a1a1aa; line-height: 1.5; word-break: break-all;">
            Or copy this link: ${url}
          </p>
        </div>

        <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
          Heartwood - Authentication for AutumnsGrove
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

const MAGIC_LINK_EMAIL_TEXT = (url: string) => `
Heartwood Login

Click the link below to sign in:
${url}

This link will expire in 10 minutes.

If you didn't request this link, you can safely ignore this email.

---
Heartwood - Authentication for AutumnsGrove
`.trim();

/**
 * Create a Better Auth instance configured for Cloudflare
 *
 * @param env - Cloudflare Worker environment bindings
 * @returns Configured Better Auth instance
 */
export function createAuth(env: Env) {
  // Create Drizzle instance for D1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = drizzle(env.DB) as any;
  const groveDb = createDbSession(env);

  return betterAuth({
    // Base URL for auth endpoints
    baseURL: env.AUTH_BASE_URL,

    // Secret for signing tokens and cookies
    secret: env.SESSION_SECRET,

    // Database configuration via better-auth-cloudflare
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        d1: {
          db,
          options: {
            // Use ba_ prefix for Better Auth tables
            usePlural: false, // ba_user, ba_session, etc. (not plural)
          },
        },
        kv: env.SESSION_KV,
      },
      {
        // Disable Better Auth's built-in rate limiting
        // Grove uses its own Threshold pattern for rate limiting
        rateLimit: {
          enabled: false,
        },
      }
    ),

    // Table name configuration - use ba_ prefix
    // This maps to our migration: ba_user, ba_session, ba_account, ba_verification
    database: {
      type: 'd1',
      tablePrefix: 'ba_',
    },

    // Session configuration
    session: {
      // 7 days session expiry
      expiresIn: 7 * 24 * 60 * 60,
      // Refresh session if within 7 days of expiry
      updateAge: 7 * 24 * 60 * 60,
      // Cross-subdomain cookie for .grove.place
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minute cache
      },
    },

    // Cookie configuration for cross-subdomain auth
    advanced: {
      crossSubDomainCookies: {
        enabled: true,
        domain: '.grove.place',
      },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
      },
    },

    // Extended user schema (Grove-specific fields)
    user: {
      additionalFields: {
        // Multi-tenant association
        tenantId: {
          type: 'string',
          required: false,
          input: false,
        },
        // Administrative access flag
        isAdmin: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
        // Track login frequency
        loginCount: {
          type: 'number',
          required: false,
          defaultValue: 0,
          input: false,
        },
        // Moderation: is user banned?
        banned: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
        // Moderation: reason for ban
        banReason: {
          type: 'string',
          required: false,
          input: false,
        },
        // Moderation: when ban expires (null = permanent)
        banExpires: {
          type: 'date',
          required: false,
          input: false,
        },
      },
    },

    // OAuth providers
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ['openid', 'email', 'profile'],
      },
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        scope: ['identify', 'email'],
      },
    },

    // Plugins
    plugins: [
      // Magic link authentication
      magicLink({
        // Link expires in 10 minutes
        expiresIn: 10 * 60,

        // Disable signup via magic link (allowlist only)
        disableSignUp: false,

        // Send magic link email via Resend
        sendMagicLink: async ({ email, url }) => {
          try {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Heartwood <auth@grove.place>',
                to: email,
                subject: 'Sign in to Heartwood',
                html: MAGIC_LINK_EMAIL_HTML(url),
                text: MAGIC_LINK_EMAIL_TEXT(url),
              }),
            });

            if (!response.ok) {
              const error = await response.text();
              console.error('[MagicLink] Failed to send email:', error);
              throw new Error('Failed to send magic link email');
            }

            console.log('[MagicLink] Sent magic link');
          } catch (error) {
            console.error('[MagicLink] Error sending email:', error);
            throw error;
          }
        },
      }),

      // Passkey (WebAuthn) authentication
      passkey({
        rpID: 'grove.place',
        rpName: 'Heartwood',
        origin: env.AUTH_BASE_URL,
      }),

      // Two-factor authentication (TOTP)
      twoFactor({
        issuer: 'Heartwood',
        totpOptions: {
          digits: 6,
          period: 30,
        },
        backupCodeOptions: {
          length: 10,
          count: 10,
        },
      }),
    ],

    // Hooks for Grove-specific logic
    databaseHooks: {
      user: {
        // Enforce email allowlist before creating user (unless public signup is enabled)
        create: {
          before: async (user) => {
            // Check feature flag first - if public signup is enabled, skip allowlist
            if (env.PUBLIC_SIGNUP_ENABLED === 'true') {
              console.log('[Auth] Public signup enabled - creating new user');
              return { data: user };
            }

            // Existing allowlist enforcement
            const allowed = await isEmailAllowed(groveDb, user.email);
            if (!allowed) {
              console.log('[Auth] Signup blocked - email not in allowlist');
              throw new Error('Email not authorized. Contact an administrator for access.');
            }
            console.log('[Auth] User created successfully');
            // Return in the format expected by Better Auth hooks
            return { data: user };
          },
        },
      },
    },

    // Account linking - allow multiple providers per user
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'discord'],
      },
    },
  });
}

// Type export for use in routes
export type Auth = ReturnType<typeof createAuth>;
