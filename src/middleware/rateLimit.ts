/**
 * Rate Limiting Middleware
 */

import type { MiddlewareHandler, Context } from 'hono';
import type { Env, D1DatabaseOrSession } from '../types.js';
import { checkRateLimit } from '../db/queries.js';
import { getClientIP } from './security.js';
import {
  RATE_LIMIT_MAGIC_SEND_PER_EMAIL,
  RATE_LIMIT_MAGIC_SEND_PER_IP,
  RATE_LIMIT_TOKEN_PER_CLIENT,
  RATE_LIMIT_VERIFY_PER_CLIENT,
  RATE_LIMIT_ADMIN_PER_IP,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_PASSKEY_REGISTER,
  RATE_LIMIT_PASSKEY_DELETE,
  RATE_LIMIT_PASSKEY_AUTH,
  RATE_LIMIT_PASSKEY_WINDOW,
} from '../utils/constants.js';

interface RateLimitConfig {
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
  getKey: (c: Context<{ Bindings: Env }>) => string | null;
}

/**
 * Create a rate limiting middleware with custom configuration
 */
export function createRateLimiter(config: RateLimitConfig): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const keyPart = config.getKey(c);
    if (!keyPart) {
      // Can't identify the key, skip rate limiting
      return next();
    }

    const key = `${config.keyPrefix}:${keyPart}`;
    const { allowed, remaining, resetAt } = await checkRateLimit(
      c.env.DB,
      key,
      config.limit,
      config.windowSeconds
    );

    // Add rate limit headers
    c.res.headers.set('X-RateLimit-Limit', String(config.limit));
    c.res.headers.set('X-RateLimit-Remaining', String(remaining));
    c.res.headers.set('X-RateLimit-Reset', String(Math.floor(resetAt.getTime() / 1000)));

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
      return c.json(
        {
          error: 'rate_limit',
          message: 'Too many requests. Please try again later.',
          retry_after: retryAfter,
        },
        429,
        {
          'Retry-After': String(retryAfter),
        }
      );
    }

    return next();
  };
}

/**
 * Rate limiter for magic code send endpoint (by email)
 */
export const magicSendEmailRateLimiter = createRateLimiter({
  keyPrefix: 'magic_email',
  limit: RATE_LIMIT_MAGIC_SEND_PER_EMAIL,
  windowSeconds: RATE_LIMIT_WINDOW,
  getKey: (_c) => {
    // Extract email from request body (need to parse it)
    // This will be called after body parsing in the route
    return null; // Handled in route
  },
});

/**
 * Rate limiter for magic code send endpoint (by IP)
 */
export const magicSendIPRateLimiter = createRateLimiter({
  keyPrefix: 'magic_ip',
  limit: RATE_LIMIT_MAGIC_SEND_PER_IP,
  windowSeconds: RATE_LIMIT_WINDOW,
  getKey: (c) => getClientIP(c.req.raw),
});

/**
 * Rate limiter for token endpoint (by client)
 */
export const tokenRateLimiter = createRateLimiter({
  keyPrefix: 'token',
  limit: RATE_LIMIT_TOKEN_PER_CLIENT,
  windowSeconds: RATE_LIMIT_WINDOW,
  getKey: (c) => {
    // Extract client_id from form data or query
    const url = new URL(c.req.url);
    return url.searchParams.get('client_id');
  },
});

/**
 * Rate limiter for verify endpoint (by client/token)
 */
export const verifyRateLimiter = createRateLimiter({
  keyPrefix: 'verify',
  limit: RATE_LIMIT_VERIFY_PER_CLIENT,
  windowSeconds: RATE_LIMIT_WINDOW,
  getKey: (c) => {
    // Use IP as key since we don't know client_id before verification
    return getClientIP(c.req.raw);
  },
});

/**
 * Rate limiter for admin endpoints (by IP)
 * Prevents rapid enumeration of users and audit logs
 */
export const adminRateLimiter = createRateLimiter({
  keyPrefix: 'admin',
  limit: RATE_LIMIT_ADMIN_PER_IP,
  windowSeconds: RATE_LIMIT_WINDOW,
  getKey: (c) => getClientIP(c.req.raw),
});

/**
 * Rate limiter for passkey registration (by IP)
 * Defense-in-depth: limits registration attempts per hour
 */
export const passkeyRegisterRateLimiter = createRateLimiter({
  keyPrefix: 'passkey_register',
  limit: RATE_LIMIT_PASSKEY_REGISTER,
  windowSeconds: RATE_LIMIT_PASSKEY_WINDOW,
  getKey: (c) => getClientIP(c.req.raw),
});

/**
 * Rate limiter for passkey deletion (by IP)
 * Prevents rapid passkey removal (stolen device protection)
 */
export const passkeyDeleteRateLimiter = createRateLimiter({
  keyPrefix: 'passkey_delete',
  limit: RATE_LIMIT_PASSKEY_DELETE,
  windowSeconds: RATE_LIMIT_PASSKEY_WINDOW,
  getKey: (c) => getClientIP(c.req.raw),
});

/**
 * Rate limiter for passkey authentication (by IP)
 * Limits authentication attempts per minute
 */
export const passkeyAuthRateLimiter = createRateLimiter({
  keyPrefix: 'passkey_auth',
  limit: RATE_LIMIT_PASSKEY_AUTH,
  windowSeconds: RATE_LIMIT_WINDOW,
  getKey: (c) => getClientIP(c.req.raw),
});

/**
 * Check rate limit for a specific key (for use in routes)
 */
export async function checkRouteRateLimit(
  db: D1DatabaseOrSession,
  keyPrefix: string,
  keyPart: string,
  limit: number,
  windowSeconds: number = RATE_LIMIT_WINDOW
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const key = `${keyPrefix}:${keyPart}`;
  const { allowed, remaining, resetAt } = await checkRateLimit(
    db,
    key,
    limit,
    windowSeconds
  );

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining };
}
