/**
 * Integration tests for magic code routes
 * Tests send flow, verify flow, rate limiting, lockout, and email enumeration prevention
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../types.js';
import { createMockEnv, TEST_USER } from '../test-helpers.js';

// Mock database queries
vi.mock('../db/queries.js', () => ({
  getClientByClientId: vi.fn(),
  validateClientRedirectUri: vi.fn(),
  isEmailAllowed: vi.fn(),
  createMagicCode: vi.fn(),
  getMagicCode: vi.fn(),
  markMagicCodeUsed: vi.fn(),
  createAuthCode: vi.fn(),
  isAccountLocked: vi.fn(),
  recordFailedAttempt: vi.fn(),
  clearFailedAttempts: vi.fn(),
  createAuditLog: vi.fn(),
}));

// Mock db session
vi.mock('../db/session.js', () => ({
  createDbSession: vi.fn().mockReturnValue({}),
}));

// Mock rate limiting
vi.mock('../middleware/rateLimit.js', () => ({
  checkRouteRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
}));

// Mock email service
vi.mock('../services/email.js', () => ({
  sendMagicCodeEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock user service
vi.mock('../services/user.js', () => ({
  authenticateUser: vi.fn(),
}));

import magicRoutes from './magic.js';
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
import { checkRouteRateLimit } from '../middleware/rateLimit.js';
import { sendMagicCodeEmail } from '../services/email.js';
import { authenticateUser } from '../services/user.js';

function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/magic', magicRoutes);
  return app;
}

const mockEnv = createMockEnv();

async function makeSendRequest(body: unknown) {
  const app = createApp();
  return app.request('/magic/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, mockEnv);
}

async function makeVerifyRequest(body: unknown) {
  const app = createApp();
  return app.request('/magic/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, mockEnv);
}

// =============================================================================
// POST /magic/send
// =============================================================================

describe('POST /magic/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'client-1',
      client_id: 'test-app',
    });
    (validateClientRedirectUri as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (isEmailAllowed as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (isAccountLocked as ReturnType<typeof vi.fn>).mockResolvedValue({ locked: false });
    (createMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createAuditLog as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (checkRouteRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true, remaining: 10 });
  });

  it('returns 400 for invalid JSON body', async () => {
    const app = createApp();
    const res = await app.request('/magic/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }, mockEnv);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_request');
  });

  it('returns 400 for missing email', async () => {
    const res = await makeSendRequest({
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await makeSendRequest({
      email: 'not-an-email',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid redirect_uri', async () => {
    const res = await makeSendRequest({
      email: 'user@example.com',
      client_id: 'test-app',
      redirect_uri: 'not-a-url',
    });
    expect(res.status).toBe(400);
  });

  it('returns 429 when IP rate limited', async () => {
    (checkRouteRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfter: 30,
    });

    const res = await makeSendRequest({
      email: 'user@example.com',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
    });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe('rate_limit');
  });

  it('returns 429 when email rate limited', async () => {
    // First call (IP check) passes, second call (email check) fails
    (checkRouteRateLimit as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ allowed: true, remaining: 5 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfter: 60 });

    const res = await makeSendRequest({
      email: 'user@example.com',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
    });
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid client', async () => {
    (getClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await makeSendRequest({
      email: 'user@example.com',
      client_id: 'nonexistent',
      redirect_uri: 'https://app.example.com/callback',
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_client');
  });

  it('returns 400 for invalid redirect_uri (not registered)', async () => {
    (validateClientRedirectUri as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await makeSendRequest({
      email: 'user@example.com',
      client_id: 'test-app',
      redirect_uri: 'https://evil.com/steal',
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain('redirect_uri');
  });

  it('sends email for allowed user', async () => {
    const res = await makeSendRequest({
      email: 'allowed@example.com',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(sendMagicCodeEmail).toHaveBeenCalled();
    expect(createMagicCode).toHaveBeenCalled();
  });

  it('returns success even for non-allowed email (prevents enumeration)', async () => {
    (isEmailAllowed as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await makeSendRequest({
      email: 'stranger@example.com',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // Email should NOT be sent for non-allowed
    expect(sendMagicCodeEmail).not.toHaveBeenCalled();
    expect(createMagicCode).not.toHaveBeenCalled();
  });

  it('does not send email when account is locked', async () => {
    (isAccountLocked as ReturnType<typeof vi.fn>).mockResolvedValue({
      locked: true,
      lockedUntil: new Date(Date.now() + 900000),
    });

    const res = await makeSendRequest({
      email: 'locked@example.com',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
    });

    // Still returns success (enumeration prevention)
    expect(res.status).toBe(200);
    expect(sendMagicCodeEmail).not.toHaveBeenCalled();
  });

  it('returns consistent success message', async () => {
    const res = await makeSendRequest({
      email: 'user@example.com',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
    });

    const json = await res.json();
    expect(json.message).toBe('If this email is registered, a code has been sent.');
  });
});

// =============================================================================
// POST /magic/verify
// =============================================================================

describe('POST /magic/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'client-1',
      client_id: 'test-app',
    });
    (validateClientRedirectUri as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (isAccountLocked as ReturnType<typeof vi.fn>).mockResolvedValue({ locked: false });
  });

  it('returns 400 for invalid JSON', async () => {
    const app = createApp();
    const res = await app.request('/magic/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad json',
    }, mockEnv);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid request params', async () => {
    const res = await makeVerifyRequest({
      email: 'user@example.com',
      code: '12345', // Too short
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric code', async () => {
    const res = await makeVerifyRequest({
      email: 'user@example.com',
      code: 'abcdef',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid client', async () => {
    (getClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await makeVerifyRequest({
      email: 'user@example.com',
      code: '123456',
      client_id: 'nonexistent',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_client');
  });

  it('returns 400 for invalid redirect_uri', async () => {
    (validateClientRedirectUri as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await makeVerifyRequest({
      email: 'user@example.com',
      code: '123456',
      client_id: 'test-app',
      redirect_uri: 'https://evil.com/steal',
      state: 'state-123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 423 when account is locked', async () => {
    (isAccountLocked as ReturnType<typeof vi.fn>).mockResolvedValue({
      locked: true,
      lockedUntil: new Date('2025-06-01T01:00:00Z'),
    });

    const res = await makeVerifyRequest({
      email: 'locked@example.com',
      code: '123456',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });
    expect(res.status).toBe(423);
    const json = await res.json();
    expect(json.error).toBe('account_locked');
  });

  it('returns 401 for invalid/expired code', async () => {
    (getMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recordFailedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({ locked: false });

    const res = await makeVerifyRequest({
      email: 'user@example.com',
      code: '999999',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('invalid_code');
  });

  it('records failed attempt on invalid code', async () => {
    (getMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recordFailedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({ locked: false });

    await makeVerifyRequest({
      email: 'user@example.com',
      code: '999999',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });

    expect(recordFailedAttempt).toHaveBeenCalledWith(
      expect.anything(),
      'user@example.com',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('returns 423 when failed attempts trigger lockout', async () => {
    (getMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recordFailedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      locked: true,
      lockedUntil: new Date('2025-06-01T01:15:00Z'),
    });

    const res = await makeVerifyRequest({
      email: 'user@example.com',
      code: '999999',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });
    expect(res.status).toBe(423);
    const json = await res.json();
    expect(json.error).toBe('account_locked');
  });

  it('returns 403 when email not authorized', async () => {
    (getMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'mc-1',
      email: 'user@example.com',
      code: '123456',
    });
    (markMagicCodeUsed as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (clearFailedAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (authenticateUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await makeVerifyRequest({
      email: 'user@example.com',
      code: '123456',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('access_denied');
  });

  it('returns redirect URL on successful verification', async () => {
    (getMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'mc-1',
      email: 'user@example.com',
      code: '123456',
    });
    (markMagicCodeUsed as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (clearFailedAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (authenticateUser as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (createAuthCode as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createAuditLog as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await makeVerifyRequest({
      email: 'user@example.com',
      code: '123456',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'my-state-value',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirect_uri).toContain('https://app.example.com/callback');
    expect(json.redirect_uri).toContain('code=');
    expect(json.redirect_uri).toContain('state=my-state-value');
  });

  it('marks code as used on success', async () => {
    (getMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'mc-1',
      email: 'user@example.com',
      code: '123456',
    });
    (markMagicCodeUsed as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (clearFailedAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (authenticateUser as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (createAuthCode as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createAuditLog as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await makeVerifyRequest({
      email: 'user@example.com',
      code: '123456',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });

    expect(markMagicCodeUsed).toHaveBeenCalledWith(expect.anything(), 'mc-1');
  });

  it('clears failed attempts on success', async () => {
    (getMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'mc-1',
      email: 'user@example.com',
      code: '123456',
    });
    (markMagicCodeUsed as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (clearFailedAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (authenticateUser as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (createAuthCode as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createAuditLog as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await makeVerifyRequest({
      email: 'user@example.com',
      code: '123456',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });

    expect(clearFailedAttempts).toHaveBeenCalledWith(expect.anything(), 'user@example.com');
  });

  it('creates audit log on successful verification', async () => {
    (getMagicCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'mc-1',
      email: 'user@example.com',
      code: '123456',
    });
    (markMagicCodeUsed as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (clearFailedAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (authenticateUser as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER);
    (createAuthCode as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createAuditLog as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await makeVerifyRequest({
      email: 'user@example.com',
      code: '123456',
      client_id: 'test-app',
      redirect_uri: 'https://app.example.com/callback',
      state: 'state-123',
    });

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event_type: 'magic_code_verified',
        user_id: TEST_USER.id,
        client_id: 'test-app',
      })
    );
  });
});
