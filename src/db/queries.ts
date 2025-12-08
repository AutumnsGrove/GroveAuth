/**
 * Database query functions
 */

import type {
  Client,
  User,
  AllowedEmail,
  AuthCode,
  RefreshToken,
  MagicCode,
  RateLimit,
  FailedAttempt,
  AuditEventType,
  OAuthState,
  UserSubscription,
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionAuditEventType,
} from '../types.js';
import { TIER_POST_LIMITS } from '../types.js';
import { generateUUID } from '../utils/crypto.js';

// ==================== Clients ====================

export async function getClientByClientId(
  db: D1Database,
  clientId: string
): Promise<Client | null> {
  const result = await db
    .prepare('SELECT * FROM clients WHERE client_id = ?')
    .bind(clientId)
    .first<Client>();
  return result;
}

export async function validateClientRedirectUri(
  db: D1Database,
  clientId: string,
  redirectUri: string
): Promise<boolean> {
  const client = await getClientByClientId(db, clientId);
  if (!client) return false;

  const allowedUris: string[] = JSON.parse(client.redirect_uris);
  return allowedUris.includes(redirectUri);
}

export async function validateClientOrigin(
  db: D1Database,
  clientId: string,
  origin: string
): Promise<boolean> {
  const client = await getClientByClientId(db, clientId);
  if (!client) return false;

  const allowedOrigins: string[] = JSON.parse(client.allowed_origins);
  return allowedOrigins.includes(origin);
}

// ==================== Users ====================

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const result = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
  return result;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<User>();
  return result;
}

export async function createUser(
  db: D1Database,
  data: {
    email: string;
    name: string | null;
    avatar_url: string | null;
    provider: string;
    provider_id: string | null;
  }
): Promise<User> {
  const id = generateUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url, provider, provider_id, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, data.email.toLowerCase(), data.name, data.avatar_url, data.provider, data.provider_id, now, now)
    .run();

  return (await getUserById(db, id))!;
}

export async function updateUserLogin(
  db: D1Database,
  id: string,
  data: { name?: string | null; avatar_url?: string | null }
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE users SET name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url), last_login = ? WHERE id = ?`
    )
    .bind(data.name, data.avatar_url, now, id)
    .run();
}

export async function getOrCreateUser(
  db: D1Database,
  data: {
    email: string;
    name: string | null;
    avatar_url: string | null;
    provider: string;
    provider_id: string | null;
  }
): Promise<User> {
  const existing = await getUserByEmail(db, data.email);

  if (existing) {
    await updateUserLogin(db, existing.id, { name: data.name, avatar_url: data.avatar_url });
    return (await getUserById(db, existing.id))!;
  }

  return createUser(db, data);
}

// ==================== Allowed Emails ====================

export async function isEmailAllowed(db: D1Database, email: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT email FROM allowed_emails WHERE email = ?')
    .bind(email.toLowerCase())
    .first<AllowedEmail>();
  return result !== null;
}

// ==================== Auth Codes ====================

export async function createAuthCode(
  db: D1Database,
  data: {
    code: string;
    client_id: string;
    user_id: string;
    redirect_uri: string;
    code_challenge?: string;
    code_challenge_method?: string;
    expires_at: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO auth_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.code,
      data.client_id,
      data.user_id,
      data.redirect_uri,
      data.code_challenge || null,
      data.code_challenge_method || null,
      data.expires_at
    )
    .run();
}

export async function getAuthCode(db: D1Database, code: string): Promise<AuthCode | null> {
  const result = await db
    .prepare('SELECT * FROM auth_codes WHERE code = ?')
    .bind(code)
    .first<AuthCode>();
  return result;
}

export async function markAuthCodeUsed(db: D1Database, code: string): Promise<void> {
  await db.prepare('UPDATE auth_codes SET used = 1 WHERE code = ?').bind(code).run();
}

export async function cleanupExpiredAuthCodes(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare('DELETE FROM auth_codes WHERE expires_at < ? OR used = 1').bind(now).run();
}

// ==================== Refresh Tokens ====================

export async function createRefreshToken(
  db: D1Database,
  data: {
    token_hash: string;
    user_id: string;
    client_id: string;
    expires_at: string;
  }
): Promise<string> {
  const id = generateUUID();

  await db
    .prepare(
      `INSERT INTO refresh_tokens (id, token_hash, user_id, client_id, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, data.token_hash, data.user_id, data.client_id, data.expires_at)
    .run();

  return id;
}

export async function getRefreshTokenByHash(
  db: D1Database,
  tokenHash: string
): Promise<RefreshToken | null> {
  const result = await db
    .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0')
    .bind(tokenHash)
    .first<RefreshToken>();
  return result;
}

export async function revokeRefreshToken(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').bind(tokenHash).run();
}

export async function revokeAllUserTokens(db: D1Database, userId: string): Promise<void> {
  await db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').bind(userId).run();
}

export async function cleanupExpiredRefreshTokens(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked = 1').bind(now).run();
}

// ==================== Magic Codes ====================

export async function createMagicCode(
  db: D1Database,
  data: {
    email: string;
    code: string;
    expires_at: string;
  }
): Promise<void> {
  const id = generateUUID();

  await db
    .prepare('INSERT INTO magic_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, data.email.toLowerCase(), data.code, data.expires_at)
    .run();
}

export async function getMagicCode(
  db: D1Database,
  email: string,
  code: string
): Promise<MagicCode | null> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      'SELECT * FROM magic_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > ?'
    )
    .bind(email.toLowerCase(), code, now)
    .first<MagicCode>();
  return result;
}

export async function markMagicCodeUsed(db: D1Database, id: string): Promise<void> {
  await db.prepare('UPDATE magic_codes SET used = 1 WHERE id = ?').bind(id).run();
}

export async function cleanupExpiredMagicCodes(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare('DELETE FROM magic_codes WHERE expires_at < ? OR used = 1').bind(now).run();
}

// ==================== Rate Limiting ====================

export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000).toISOString();

  const existing = await db
    .prepare('SELECT * FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<RateLimit>();

  if (!existing || existing.window_start < windowStart) {
    // Reset or create new window
    await db
      .prepare(
        `INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)`
      )
      .bind(key, now.toISOString())
      .run();

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(now.getTime() + windowSeconds * 1000),
    };
  }

  if (existing.count >= limit) {
    const resetAt = new Date(new Date(existing.window_start).getTime() + windowSeconds * 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  await db
    .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?')
    .bind(key)
    .run();

  return {
    allowed: true,
    remaining: limit - existing.count - 1,
    resetAt: new Date(new Date(existing.window_start).getTime() + windowSeconds * 1000),
  };
}

// ==================== Failed Attempts ====================

export async function recordFailedAttempt(
  db: D1Database,
  email: string,
  maxAttempts: number,
  lockoutSeconds: number
): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const now = new Date();
  const existing = await db
    .prepare('SELECT * FROM failed_attempts WHERE email = ?')
    .bind(email.toLowerCase())
    .first<FailedAttempt>();

  if (existing?.locked_until && new Date(existing.locked_until) > now) {
    return { locked: true, lockedUntil: new Date(existing.locked_until) };
  }

  const newAttempts = (existing?.attempts || 0) + 1;

  if (newAttempts >= maxAttempts) {
    const lockedUntil = new Date(now.getTime() + lockoutSeconds * 1000);
    await db
      .prepare(
        `INSERT OR REPLACE INTO failed_attempts (email, attempts, last_attempt, locked_until)
         VALUES (?, ?, ?, ?)`
      )
      .bind(email.toLowerCase(), newAttempts, now.toISOString(), lockedUntil.toISOString())
      .run();
    return { locked: true, lockedUntil };
  }

  await db
    .prepare(
      `INSERT OR REPLACE INTO failed_attempts (email, attempts, last_attempt, locked_until)
       VALUES (?, ?, ?, NULL)`
    )
    .bind(email.toLowerCase(), newAttempts, now.toISOString())
    .run();

  return { locked: false, lockedUntil: null };
}

export async function clearFailedAttempts(db: D1Database, email: string): Promise<void> {
  await db.prepare('DELETE FROM failed_attempts WHERE email = ?').bind(email.toLowerCase()).run();
}

export async function isAccountLocked(
  db: D1Database,
  email: string
): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const now = new Date();
  const existing = await db
    .prepare('SELECT * FROM failed_attempts WHERE email = ?')
    .bind(email.toLowerCase())
    .first<FailedAttempt>();

  if (existing?.locked_until && new Date(existing.locked_until) > now) {
    return { locked: true, lockedUntil: new Date(existing.locked_until) };
  }

  return { locked: false, lockedUntil: null };
}

// ==================== Audit Log ====================

export async function createAuditLog(
  db: D1Database,
  data: {
    event_type: AuditEventType;
    user_id?: string;
    client_id?: string;
    ip_address?: string;
    user_agent?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  const id = generateUUID();

  await db
    .prepare(
      `INSERT INTO audit_log (id, event_type, user_id, client_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      data.event_type,
      data.user_id || null,
      data.client_id || null,
      data.ip_address || null,
      data.user_agent || null,
      data.details ? JSON.stringify(data.details) : null
    )
    .run();
}

// ==================== OAuth State ====================

export async function saveOAuthState(
  db: D1Database,
  data: {
    state: string;
    client_id: string;
    redirect_uri: string;
    code_challenge?: string;
    code_challenge_method?: string;
    original_state: string;
    expires_at: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO oauth_states (state, client_id, redirect_uri, code_challenge, code_challenge_method, original_state, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.state,
      data.client_id,
      data.redirect_uri,
      data.code_challenge || null,
      data.code_challenge_method || null,
      data.original_state,
      data.expires_at
    )
    .run();
}

export async function getOAuthState(db: D1Database, state: string): Promise<OAuthState | null> {
  const now = new Date().toISOString();
  const result = await db
    .prepare('SELECT * FROM oauth_states WHERE state = ? AND expires_at > ?')
    .bind(state, now)
    .first<OAuthState & { original_state: string }>();

  if (!result) return null;

  return {
    client_id: result.client_id,
    redirect_uri: result.redirect_uri,
    state: result.original_state,
    code_challenge: result.code_challenge || undefined,
    code_challenge_method: result.code_challenge_method || undefined,
  };
}

export async function deleteOAuthState(db: D1Database, state: string): Promise<void> {
  await db.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
}

export async function cleanupExpiredOAuthStates(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(now).run();
}

// ==================== User Subscriptions ====================

export async function getUserSubscription(db: D1Database, userId: string): Promise<UserSubscription | null> {
  return db.prepare('SELECT * FROM user_subscriptions WHERE user_id = ?').bind(userId).first<UserSubscription>();
}

export async function createUserSubscription(db: D1Database, userId: string, tier: SubscriptionTier = 'starter'): Promise<UserSubscription> {
  const id = generateUUID();
  const postLimit = TIER_POST_LIMITS[tier];
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO user_subscriptions (id, user_id, tier, post_limit, post_count, grace_period_days, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 14, ?, ?)`
  ).bind(id, userId, tier, postLimit, now, now).run();

  await createSubscriptionAuditLog(db, {
    user_id: userId,
    event_type: 'subscription_created',
    new_value: JSON.stringify({ tier, post_limit: postLimit }),
  });

  return (await getUserSubscription(db, userId))!;
}

export async function getOrCreateUserSubscription(db: D1Database, userId: string): Promise<UserSubscription> {
  const existing = await getUserSubscription(db, userId);
  if (existing) return existing;
  return createUserSubscription(db, userId, 'starter');
}

export async function incrementPostCount(db: D1Database, userId: string): Promise<UserSubscription | null> {
  const subscription = await getUserSubscription(db, userId);
  if (!subscription) return null;

  const newCount = subscription.post_count + 1;
  const now = new Date().toISOString();
  const isAtLimit = subscription.post_limit !== null && newCount >= subscription.post_limit;

  let graceStart = subscription.grace_period_start;
  if (isAtLimit && !graceStart) {
    graceStart = now;
  }

  await db.prepare(
    `UPDATE user_subscriptions SET post_count = ?, grace_period_start = ?, updated_at = ? WHERE user_id = ?`
  ).bind(newCount, graceStart, now, userId).run();

  return getUserSubscription(db, userId);
}

export async function decrementPostCount(db: D1Database, userId: string): Promise<UserSubscription | null> {
  const subscription = await getUserSubscription(db, userId);
  if (!subscription) return null;

  const newCount = Math.max(0, subscription.post_count - 1);
  const now = new Date().toISOString();

  // Clear grace period if now under limit
  let graceStart = subscription.grace_period_start;
  if (subscription.post_limit !== null && newCount < subscription.post_limit) {
    graceStart = null;
  }

  await db.prepare(
    `UPDATE user_subscriptions SET post_count = ?, grace_period_start = ?, updated_at = ? WHERE user_id = ?`
  ).bind(newCount, graceStart, now, userId).run();

  return getUserSubscription(db, userId);
}

export async function setPostCount(db: D1Database, userId: string, count: number): Promise<UserSubscription | null> {
  const subscription = await getUserSubscription(db, userId);
  if (!subscription) return null;

  const newCount = Math.max(0, count);
  const now = new Date().toISOString();
  const isAtLimit = subscription.post_limit !== null && newCount >= subscription.post_limit;

  // Set or clear grace period based on limit
  let graceStart = subscription.grace_period_start;
  if (isAtLimit && !graceStart) {
    graceStart = now;
  } else if (subscription.post_limit !== null && newCount < subscription.post_limit) {
    graceStart = null;
  }

  await db.prepare(
    `UPDATE user_subscriptions SET post_count = ?, grace_period_start = ?, updated_at = ? WHERE user_id = ?`
  ).bind(newCount, graceStart, now, userId).run();

  return getUserSubscription(db, userId);
}

export async function updateSubscriptionTier(db: D1Database, userId: string, newTier: SubscriptionTier): Promise<UserSubscription | null> {
  const subscription = await getUserSubscription(db, userId);
  if (!subscription) return null;

  const oldTier = subscription.tier;
  const newPostLimit = TIER_POST_LIMITS[newTier];
  const now = new Date().toISOString();

  // Clear grace period when upgrading (user is no longer at limit with new tier)
  let graceStart = subscription.grace_period_start;
  if (newPostLimit === null || subscription.post_count < newPostLimit) {
    graceStart = null;
  }

  await db.prepare(
    `UPDATE user_subscriptions SET tier = ?, post_limit = ?, grace_period_start = ?, updated_at = ? WHERE user_id = ?`
  ).bind(newTier, newPostLimit, graceStart, now, userId).run();

  // Determine event type
  const tierOrder = { starter: 0, professional: 1, business: 2 };
  const eventType: SubscriptionAuditEventType = tierOrder[newTier] > tierOrder[oldTier] ? 'tier_upgraded' : 'tier_downgraded';

  await createSubscriptionAuditLog(db, {
    user_id: userId,
    event_type: eventType,
    old_value: JSON.stringify({ tier: oldTier, post_limit: subscription.post_limit }),
    new_value: JSON.stringify({ tier: newTier, post_limit: newPostLimit }),
  });

  return getUserSubscription(db, userId);
}

export function getSubscriptionStatus(subscription: UserSubscription): SubscriptionStatus {
  const { tier, post_count, post_limit, grace_period_start, grace_period_days } = subscription;

  const posts_remaining = post_limit !== null ? Math.max(0, post_limit - post_count) : null;
  const percentage_used = post_limit !== null ? Math.min(100, (post_count / post_limit) * 100) : null;
  const is_at_limit = post_limit !== null && post_count >= post_limit;

  let is_in_grace_period = false;
  let grace_period_days_remaining: number | null = null;

  if (grace_period_start) {
    is_in_grace_period = true;
    const graceStart = new Date(grace_period_start);
    const graceEnd = new Date(graceStart.getTime() + grace_period_days * 24 * 60 * 60 * 1000);
    const msRemaining = graceEnd.getTime() - Date.now();
    grace_period_days_remaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  }

  const grace_expired = grace_period_days_remaining !== null && grace_period_days_remaining <= 0;
  const can_create_post = !is_at_limit || (is_in_grace_period && !grace_expired);
  const upgrade_required = is_at_limit && grace_expired;

  return {
    tier, post_count, post_limit, posts_remaining, percentage_used,
    is_at_limit, is_in_grace_period, grace_period_days_remaining,
    can_create_post, upgrade_required,
  };
}

export async function canUserCreatePost(db: D1Database, userId: string): Promise<{ allowed: boolean; status: SubscriptionStatus; subscription: UserSubscription }> {
  const subscription = await getOrCreateUserSubscription(db, userId);
  const status = getSubscriptionStatus(subscription);
  return { allowed: status.can_create_post, status, subscription };
}

export async function createSubscriptionAuditLog(db: D1Database, data: {
  user_id: string;
  event_type: SubscriptionAuditEventType;
  old_value?: string;
  new_value?: string;
}): Promise<void> {
  const id = generateUUID();
  await db.prepare(
    `INSERT INTO subscription_audit_log (id, user_id, event_type, old_value, new_value) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, data.user_id, data.event_type, data.old_value || null, data.new_value || null).run();
}
