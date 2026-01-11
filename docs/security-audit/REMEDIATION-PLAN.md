# Grove Authentication Service - Security Remediation Plan

**Generated:** January 2026
**Purpose:** Actionable tasks for remediating security findings
**Usage:** Each task is self-contained and can be executed independently

---

## Priority Legend

- **P0 - Critical**: Must fix before any production deployment
- **P1 - High**: Should fix before production, blocks launch
- **P2 - Medium**: Fix soon after launch
- **P3 - Low**: Address when convenient

---

# P0 - Critical Priority Tasks

---

## Task API-001: Fix Authorization Bypass in Subscription Endpoints

**Severity**: Critical (CVSS 9.1)
**File(s)**: `/home/user/GroveAuth/src/routes/subscription.ts` (lines 56-76, 98-139, 145-184)
**Category**: API / Authorization

### Problem
The subscription endpoints verify that a user has a valid token but do not verify that the user owns the subscription they are accessing. Any authenticated user can read, modify, or delete any other user's subscription data by simply changing the `userId` parameter in the URL.

### Current Code
```typescript
// Line 56-76 - GET /:userId
subscription.get('/:userId', async (c) => {
  const payload = await verifyBearerToken(c);
  if (!payload) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const userId = c.req.param('userId');
  const db = createDbClient(c.env.DB);
  const sub = await getUserSubscription(db, userId);  // No ownership check!
  // ...
});

// Line 98-139 - POST /:userId/increment
// Line 145-184 - POST /:userId/subscription
// Same pattern - no ownership verification
```

### Required Fix
1. Open `/home/user/GroveAuth/src/routes/subscription.ts`
2. Add an ownership check after token verification in each endpoint:

```typescript
subscription.get('/:userId', async (c) => {
  const payload = await verifyBearerToken(c);
  if (!payload) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const userId = c.req.param('userId');

  // Add authorization check - users can only access their own data
  // Admin users (if applicable) should be checked via payload.admin or similar
  if (payload.sub !== userId) {
    return c.json({ error: 'forbidden', error_description: 'Cannot access other user data' }, 403);
  }

  const db = createDbClient(c.env.DB);
  const sub = await getUserSubscription(db, userId);
  // ...
});
```

3. Apply the same pattern to POST `/:userId/increment` (around line 98)
4. Apply the same pattern to POST `/:userId/subscription` (around line 145)

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Create two users, verify user A cannot access user B's subscription
- [ ] Manual test: Verify user can still access their own subscription

### Commit Message
```
fix(security): add authorization checks to subscription endpoints

Subscription endpoints now verify that the authenticated user matches
the requested userId parameter. This prevents unauthorized access to
other users' subscription data (CVSS 9.1 authorization bypass).
```

---

## Task AUTH-001: Remove PII from OAuth Redirect URL Parameters

**Severity**: Critical
**File(s)**: `/home/user/GroveAuth/src/routes/oauth/google.ts` (lines 274-287, 204-223)
**Category**: Auth / Data Exposure

### Problem
For internal Grove services, session tokens, user IDs, and email addresses are passed as URL query parameters in the OAuth callback redirect. These values appear in browser history, server logs, CDN logs, and can leak via Referer headers. This is a significant PII exposure risk and violates data protection best practices.

### Current Code
```typescript
// Lines 274-287
function buildInternalServiceRedirect(
  redirectUri: string,
  sessionToken: string,
  userId: string,
  email: string,
  state: string
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('session_token', sessionToken);  // CRITICAL: Token in URL
  url.searchParams.set('user_id', userId);              // PII in URL
  url.searchParams.set('email', email);                 // PII in URL
  url.searchParams.set('state', state);
  return url.toString();
}
```

### Required Fix
1. Open `/home/user/GroveAuth/src/routes/oauth/google.ts`
2. Remove sensitive data from URL parameters - only keep `state` and optionally an authorization `code`
3. The session cookie (already set at line 220) should be the sole authentication mechanism

Replace the `buildInternalServiceRedirect` function:
```typescript
function buildInternalServiceRedirect(
  redirectUri: string,
  state: string
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('state', state);
  // Session cookie handles authentication - no need for URL tokens
  return url.toString();
}
```

4. Update the call site around line 204-223 to not pass sensitive data:
```typescript
// Around line 204-210, change to:
if (isInternalService) {
  const redirect = buildInternalServiceRedirect(
    validated_redirect_uri,
    state
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirect,
      'Set-Cookie': sessionCookieHeader,
    },
  });
}
```

5. Ensure the receiving internal services read the session from the cookie, not URL parameters

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Complete OAuth flow and verify URL contains only `state` parameter
- [ ] Manual test: Verify session cookie is set and contains authentication data
- [ ] Verify internal services can authenticate via cookie

### Commit Message
```
fix(security): remove PII and session tokens from OAuth redirect URLs

Session tokens, user IDs, and emails were being passed in URL query
parameters during OAuth callbacks. These are now removed - authentication
relies solely on the secure HTTP-only session cookie. This prevents
token leakage via browser history, server logs, and Referer headers.
```

---

## Task DATA-001: Remove Email Logging from Console Output

**Severity**: Critical
**File(s)**: `/home/user/GroveAuth/src/auth/index.ts` (lines 253, 290, 297, 300)
**Category**: Data / PII Exposure

### Problem
Email addresses (PII under GDPR/CCPA) are logged to console in multiple locations. Console logs may be visible to developers, stored in log aggregation services, and captured by CI/CD systems. This violates data protection regulations and security best practices.

### Current Code
```typescript
// Line 253
console.log(`[MagicLink] Sent magic link to ${email}`);

// Line 290
console.log(`[Auth] Signup blocked - email not allowed: ${email}`);

// Line 297
console.log(`[Auth] Public signup enabled - creating user: ${user.email}`);

// Line 300
console.log(`[Auth] User created: ${user.email}`);
```

### Required Fix
1. Open `/home/user/GroveAuth/src/auth/index.ts`
2. Replace email addresses with anonymized identifiers or remove entirely

```typescript
// Line 253 - Replace with:
console.log(`[MagicLink] Sent magic link to user`);

// Line 290 - Replace with:
console.log(`[Auth] Signup blocked - email not in allowlist`);

// Line 297 - Replace with:
console.log(`[Auth] Public signup enabled - creating new user`);

// Line 300 - Replace with:
console.log(`[Auth] User created successfully`);
```

3. If user identification is needed for debugging, use a hashed or truncated identifier:
```typescript
const emailHash = email.substring(0, 3) + '***';
console.log(`[Auth] User created: ${emailHash}`);
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Grep for email logging: `grep -r "console.log.*email" src/` should return no results with actual emails
- [ ] Manual test: Trigger each code path and verify console output contains no emails

### Commit Message
```
fix(security): remove email addresses from console logs

Email addresses were being logged to console in multiple auth flows.
This is a PII exposure risk under GDPR/CCPA. Logs now use anonymized
identifiers or generic messages instead.
```

---

## Task DATA-002: Encrypt OAuth Provider Tokens at Rest

**Severity**: Critical
**File(s)**: `/home/user/GroveAuth/src/db/auth.schema.ts` (lines 87-94)
**Category**: Data / Encryption

### Problem
OAuth provider tokens (access_token, refresh_token, id_token) are stored in plaintext in the database. If the database is compromised, attackers could use these tokens to access user accounts on external providers (Google, etc.).

### Current Code
```typescript
// Lines 87-94 in auth.schema.ts
export const account = sqliteTable('account', {
  // ...
  accessToken: text('access_token'),        // PLAINTEXT
  refreshToken: text('refresh_token'),      // PLAINTEXT
  idToken: text('id_token'),                // PLAINTEXT
  // ...
});
```

### Required Fix
1. Create a new encryption utility in `/home/user/GroveAuth/src/utils/encryption.ts`:

```typescript
import { subtle } from 'crypto';

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

export async function encryptField(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    encoded
  );

  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptField(encrypted: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
```

2. Add `FIELD_ENCRYPTION_KEY` to environment variables (wrangler.toml secrets)
3. Update token storage in Better Auth configuration to encrypt before storing
4. Update token retrieval to decrypt after fetching

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Complete OAuth flow and verify tokens are encrypted in database
- [ ] Manual test: Verify token retrieval/refresh still works

### Commit Message
```
fix(security): encrypt OAuth provider tokens at rest

OAuth access_token, refresh_token, and id_token are now encrypted
using AES-GCM before storage. This protects user provider account
access if the database is compromised.
```

---

## Task DATA-003: Encrypt Sensitive Data in KV Session Cache

**Severity**: Critical
**File(s)**: `/home/user/GroveAuth/src/lib/server/session.ts` (lines 226-228)
**Category**: Data / Encryption

### Problem
Full session data including user email and name is cached in plaintext in Cloudflare KV. KV data may be accessible to all Workers in the account, creating unnecessary PII exposure.

### Current Code
```typescript
// Lines 226-228
await env.SESSION_KV.put(cacheKey, JSON.stringify(sessionData), {
  expirationTtl: SESSION_CACHE_TTL,
});
```

### Required Fix
1. Open `/home/user/GroveAuth/src/lib/server/session.ts`
2. Option A: Cache only non-sensitive metadata:

```typescript
// Cache only session metadata, not user PII
const cacheData = {
  sessionId: sessionData.sessionId,
  userId: sessionData.userId,
  expiresAt: sessionData.expiresAt,
  // Do NOT cache: email, name, avatarUrl
};

await env.SESSION_KV.put(cacheKey, JSON.stringify(cacheData), {
  expirationTtl: SESSION_CACHE_TTL,
});
```

3. Option B: Encrypt the entire cache entry using the encryption utilities from DATA-002
4. Update the cache retrieval logic to handle the new format

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify session validation still works
- [ ] Manual test: Inspect KV cache and verify no plaintext PII

### Commit Message
```
fix(security): remove PII from session cache in KV store

Session cache now stores only non-sensitive metadata (sessionId,
userId, expiresAt). User email and name are fetched from the
authoritative source when needed, not cached in KV.
```

---

## Task DATA-004: Replace SHA-256 Token Hashing with Proper KDF

**Severity**: Critical
**File(s)**: `/home/user/GroveAuth/src/utils/crypto.ts` (lines 96-106)
**Category**: Data / Cryptography

### Problem
The `hashSecret()` function uses plain SHA-256 to hash tokens. SHA-256 is a fast hash not designed for secrets - it lacks salt and has no work factor, making it vulnerable to rainbow table and brute force attacks.

### Current Code
```typescript
// Lines 96-106
export async function hashSecret(secret: string): Promise<string> {
  return sha256Base64Url(secret);
}
```

### Required Fix
1. Open `/home/user/GroveAuth/src/utils/crypto.ts`
2. Replace with PBKDF2 (available in Web Crypto API) with proper parameters:

```typescript
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  // Format: iterations$salt$hash (all base64url encoded)
  const hashArray = new Uint8Array(derivedBits);
  return `${PBKDF2_ITERATIONS}$${base64UrlEncode(salt)}$${base64UrlEncode(hashArray)}`;
}

export async function verifyHashedSecret(secret: string, storedHash: string): Promise<boolean> {
  const [iterations, saltB64, hashB64] = storedHash.split('$');
  const salt = base64UrlDecode(saltB64);
  const expectedHash = base64UrlDecode(hashB64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: parseInt(iterations),
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const actualHash = new Uint8Array(derivedBits);
  return timingSafeEqual(actualHash, expectedHash);
}
```

3. Update all callers to use the new verification function
4. Plan migration for existing hashed secrets (may need to re-hash on next use)

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Unit test: Verify hash and verify functions work correctly
- [ ] Manual test: Verify client secret validation still works

### Commit Message
```
fix(security): replace SHA-256 token hashing with PBKDF2

Token hashing now uses PBKDF2 with 100,000 iterations and random salt.
This provides proper password-grade hashing instead of fast SHA-256
which is vulnerable to brute force attacks.
```

---

## Task DO-002: Add Authorization Checks to SessionDO Methods

**Severity**: Critical
**File(s)**: `/home/user/GroveAuth/src/durables/SessionDO.ts` (lines 82-209)
**Category**: Durable Objects / Authorization

### Problem
SessionDO methods (validateSession, createSession, revokeSession, etc.) do not verify that the caller is authorized to access the sessions they're requesting. If the SESSION_SECRET is compromised, an attacker could forge session cookies and access any user's SessionDO instance.

### Current Code
```typescript
// Lines 113-152 - validateSession
async validateSession(sessionId: string, updateLastActive = true) {
  // No authorization check - trusts that caller owns this session
  const result = await this.ctx.storage.sql
    .exec(`SELECT * FROM sessions WHERE id = ?`, sessionId)
    .toArray();
  // ...
}
```

### Required Fix
1. Open `/home/user/GroveAuth/src/durables/SessionDO.ts`
2. Add a method to validate caller authorization:

```typescript
private async validateCaller(callerSessionId: string): Promise<boolean> {
  // Verify the caller's session exists in this DO
  const result = await this.ctx.storage.sql
    .exec(`SELECT id FROM sessions WHERE id = ?`, callerSessionId)
    .toArray();
  return result.length > 0;
}
```

3. Update the fetch handler to require and validate a caller session:

```typescript
async fetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const action = url.pathname.slice(1);

  // Extract caller session from request header
  const callerSession = request.headers.get('X-Caller-Session');

  // Actions that require caller validation
  const protectedActions = ['validate', 'revoke', 'list', 'revoke-all'];

  if (protectedActions.includes(action) && callerSession) {
    const isAuthorized = await this.validateCaller(callerSession);
    if (!isAuthorized) {
      return Response.json({ error: 'unauthorized' }, { status: 403 });
    }
  }

  // ... rest of action handling
}
```

4. Update callers in `/home/user/GroveAuth/src/routes/session.ts` to pass the caller session header

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify legitimate session operations still work
- [ ] Manual test: Verify forged session IDs are rejected

### Commit Message
```
fix(security): add authorization checks to SessionDO methods

SessionDO methods now validate that the caller owns a session in
the DO before performing operations. This provides defense-in-depth
against privilege escalation if SESSION_SECRET is compromised.
```

---

## Task SECRETS-001: Rotate Compromised Client Secrets

**Severity**: Critical
**File(s)**: `/home/user/GroveAuth/src/db/seed.sql` (lines 10, 21, 32, 43)
**Category**: Secrets / Exposure

### Problem
Four production client secret hashes are committed to git history:
- GroveEngine: `UUmHuEAZ07nnhhU91L1zWBdTPsZXR68JQgPW5N5aJZE`
- AutumnsGrove: `CfHJBZwJmFy0eXNx9vRUZAvXj673ePuuIGhX3IyJEik=`
- Amber: `lO8UBoFJKFkyTKvyoBp-LAyAzrC5j2kg4lQmkxKq5Vc`
- Plant: `sSqlPr1D6qdmpz2WkCz0tDmw8-60SaE0zDCuWvAdpFI`

While these are hashes, they are the verification values. An attacker with database access could use these to authenticate as these clients.

### Required Fix
**IMMEDIATE - Same Day:**

1. Generate new client secrets for all four clients:
```bash
# Generate cryptographically secure secrets
openssl rand -base64 32  # Run 4 times, once per client
```

2. Update the database directly (not via seed.sql):
```sql
-- Connect to production D1 database via wrangler
-- For each client, update with new hash
UPDATE oauth_clients
SET client_secret_hash = 'NEW_HASH_HERE'
WHERE client_id = 'grove-engine';

-- Repeat for: autumns-grove, amber, plant
```

3. Notify all client application owners to update their stored secrets

4. Update seed.sql to use placeholder values:
```sql
-- seed.sql should use placeholders, not real hashes
INSERT INTO oauth_clients (client_id, client_secret_hash, ...)
VALUES ('grove-engine', 'REPLACE_WITH_HASH', ...);
```

**FOLLOW-UP - This Week:**

5. Remove secrets from git history using BFG Repo-Cleaner:
```bash
# Install BFG
brew install bfg

# Create backup
git clone --mirror git@github.com:org/GroveAuth.git backup-repo

# Remove seed.sql history
bfg --delete-files seed.sql GroveAuth.git
cd GroveAuth.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (coordinate with team)
git push --force
```

6. Set up pre-commit hooks to prevent future secret commits

### Verification
- [ ] New secrets generated and stored securely
- [ ] Database updated with new hashes
- [ ] All client applications updated and tested
- [ ] seed.sql no longer contains real hashes
- [ ] Git history cleaned (if possible)

### Commit Message
```
fix(security): remove production secrets from seed.sql

Production client configurations removed from seed.sql. Client
secrets must now be configured via secure deployment process.
This file now contains only development/example configurations.
```

---

# P1 - High Priority Tasks

---

## Task AUTH-003: Fix CORS to Validate Against Client Registry

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/middleware/cors.ts` (lines 36-53)
**Category**: Auth / CORS

### Problem
CORS validation uses a hardcoded whitelist allowing all `*.grove.place` subdomains instead of validating against registered client origins in the database. An attacker controlling any subdomain could perform cross-origin attacks.

### Current Code
```typescript
// Lines 36-53
// For now, allow *.grove.place origins
// In production, validate against client.allowed_origins // NOT DONE
if (origin.endsWith('.grove.place') || origin === 'https://autumnsgrove.place') {
  headers['Access-Control-Allow-Origin'] = origin;
}
```

### Required Fix
1. Open `/home/user/GroveAuth/src/middleware/cors.ts`
2. Import the client validation function and database client
3. Replace hardcoded check with database lookup:

```typescript
import { getClientByOrigin } from '../db/queries';
import { createDbClient } from '../db';

export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin');
  const headers: Record<string, string> = {};

  if (origin) {
    const db = createDbClient(c.env.DB);
    const client = await getClientByOrigin(db, origin);

    if (client) {
      // Origin is registered for a valid client
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }
  }

  // Set headers and continue
  Object.entries(headers).forEach(([key, value]) => {
    c.header(key, value);
  });

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
}
```

4. Ensure `getClientByOrigin` query exists in `/home/user/GroveAuth/src/db/queries.ts`

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify registered origins work
- [ ] Manual test: Verify unregistered origins are blocked

### Commit Message
```
fix(security): validate CORS origins against client registry

CORS middleware now validates request origins against registered
client allowed_origins in the database instead of allowing all
*.grove.place subdomains. This prevents cross-origin attacks from
unauthorized subdomains.
```

---

## Task AUTH-005: Fix Race Condition in Auth Code Consumption

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/routes/token.ts` (lines 158-199)
**Category**: Auth / Race Condition

### Problem
Auth code validation and marking as used are separate database operations. Two concurrent requests with the same auth code could both pass validation before either marks the code as used, allowing the code to be redeemed twice.

### Current Code
```typescript
// Lines 158-199
const authCode = await getAuthCode(db, code);
// ... validation checks ...
await markAuthCodeUsed(db, code);  // Separate DB call - race condition!
```

### Required Fix
1. Open `/home/user/GroveAuth/src/routes/token.ts`
2. Replace the two-step process with an atomic operation:

```typescript
// Use a single UPDATE that both validates and marks used atomically
const result = await db.prepare(`
  UPDATE auth_codes
  SET used = 1, used_at = ?
  WHERE code = ?
    AND used = 0
    AND expires_at > ?
    AND client_id = ?
  RETURNING *
`).bind(
  Date.now(),
  code,
  Date.now(),
  client_id
).first();

if (!result) {
  // Either code doesn't exist, already used, expired, or wrong client
  return c.json({ error: 'invalid_grant' }, 400);
}

// Now validate PKCE with the returned code
if (result.code_challenge) {
  const valid = await verifyCodeChallenge(
    code_verifier,
    result.code_challenge,
    result.code_challenge_method || 'S256'
  );
  if (!valid) {
    return c.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
  }
}
```

3. Alternatively, use a database transaction if D1 supports it

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify auth code exchange works
- [ ] Load test: Send concurrent requests with same code, verify only one succeeds

### Commit Message
```
fix(security): prevent race condition in auth code consumption

Auth code validation and consumption now happen atomically using
a single UPDATE...RETURNING statement. This prevents the same
authorization code from being redeemed multiple times via concurrent
requests.
```

---

## Task INJ-001: Fix DOM XSS in Settings Template

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/templates/settings.ts` (lines 998, 1080, 1110)
**Category**: Injection / XSS

### Problem
Backup codes from API responses are inserted directly into the DOM via `innerHTML` without escaping. If an attacker compromises the backend or performs a MITM attack, they could inject arbitrary HTML/JavaScript.

### Current Code
```typescript
// Line 998
if (data.backupCodes) {
  backupCodesDisplay.innerHTML = data.backupCodes.map(code =>
    '<div style="margin: 4px 0;">' + code + '</div>'
  ).join('');
}

// Line 1080
backupCodesList.innerHTML = data.backupCodes.map(code =>
  '<div style="margin: 4px 0;">' + (code.used ?
    '<s style="color: var(--color-text-muted);">' + code.code + '</s>'
    : code.code) + '</div>'
).join('');
```

### Required Fix
1. Open `/home/user/GroveAuth/src/templates/settings.ts`
2. Replace innerHTML with safe DOM manipulation:

```typescript
// Line 998 - Replace with:
if (data.backupCodes) {
  backupCodesDisplay.textContent = '';  // Clear existing content
  data.backupCodes.forEach(code => {
    const div = document.createElement('div');
    div.style.margin = '4px 0';
    div.textContent = code;  // Safe - escapes HTML
    backupCodesDisplay.appendChild(div);
  });
}

// Line 1080 - Replace with:
backupCodesList.textContent = '';  // Clear existing content
data.backupCodes.forEach(codeObj => {
  const div = document.createElement('div');
  div.style.margin = '4px 0';

  if (codeObj.used) {
    const strikethrough = document.createElement('s');
    strikethrough.style.color = 'var(--color-text-muted)';
    strikethrough.textContent = codeObj.code;
    div.appendChild(strikethrough);
  } else {
    div.textContent = codeObj.code;
  }

  backupCodesList.appendChild(div);
});
```

3. Apply similar fixes to line 1110 if applicable

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify backup codes display correctly
- [ ] Security test: Inject `<script>alert(1)</script>` as backup code, verify it's escaped

### Commit Message
```
fix(security): replace innerHTML with safe DOM manipulation in settings

Backup code display now uses textContent and createElement instead
of innerHTML. This prevents DOM-based XSS if malicious content is
returned from the API.
```

---

## Task DO-007: Change Session Cookie SameSite to Strict

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/lib/session.ts` (line 138)
**Category**: Durable Objects / Session Security

### Problem
Session cookies use `SameSite=Lax` which allows cookies to be sent on top-level navigations from external sites. This could enable CSRF attacks if any endpoints modify state on GET requests.

### Current Code
```typescript
// Line 138
return `grove_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; ...`;
```

### Required Fix
1. Open `/home/user/GroveAuth/src/lib/session.ts`
2. Change `SameSite=Lax` to `SameSite=Strict`:

```typescript
// Line 138 - Change to:
return `grove_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Domain=${domain}`;
```

3. Search for any other cookie-setting code and apply the same change
4. Test that cross-origin flows (OAuth callbacks) still work correctly

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify login flow works
- [ ] Manual test: Verify OAuth callback sets cookie correctly
- [ ] Security test: Verify external site cannot send cookies with requests

### Commit Message
```
fix(security): change session cookie SameSite from Lax to Strict

Session cookies now use SameSite=Strict to prevent cookies from
being sent on cross-origin requests, reducing CSRF attack surface.
```

---

## Task DO-008: Remove User ID from Session Cookie Format

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/lib/session.ts` (lines 68-76)
**Category**: Durable Objects / Information Disclosure

### Problem
The session cookie format includes the userId in plaintext: `{sessionId}:{userId}:{signature}`. This leaks user IDs to anyone who can read cookies (browser extensions, JavaScript if not HttpOnly, etc.).

### Current Code
```typescript
// Lines 68-76
const payload = `${sessionId}:${userId}`;
const signature = await hmacSign(payload, secret);
return `${payload}:${signature}`;
```

### Required Fix
1. Open `/home/user/GroveAuth/src/lib/session.ts`
2. Change the cookie format to only include sessionId:

```typescript
// Lines 68-76 - Replace with:
export async function createSessionCookie(
  sessionId: string,
  secret: string
): Promise<string> {
  const signature = await hmacSign(sessionId, secret);
  return `${sessionId}:${signature}`;
}
```

3. Update the parsing function to match:

```typescript
export async function parseSessionCookie(
  cookie: string,
  secret: string
): Promise<{ sessionId: string } | null> {
  const parts = cookie.split(':');
  if (parts.length !== 2) return null;

  const [sessionId, signature] = parts;
  const expectedSignature = await hmacSign(sessionId, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  return { sessionId };
}
```

4. Update all callers to fetch userId from the session store using sessionId
5. Update SessionDO to store userId mapping or use existing session lookup

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify session creation and validation work
- [ ] Manual test: Inspect cookie and verify no userId visible

### Commit Message
```
fix(security): remove userId from session cookie format

Session cookies now contain only the session ID and HMAC signature.
User ID is looked up from the session store, preventing information
disclosure via cookie inspection.
```

---

## Task DO-004: Add Rate Limiting to Session Endpoints

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/routes/session.ts`
**Category**: Durable Objects / Rate Limiting

### Problem
Session management endpoints lack rate limiting:
- `POST /session/validate`
- `POST /session/revoke`
- `POST /session/revoke-all`
- `GET /session/list`
- `DELETE /session/:sessionId`

This enables DoS attacks and session enumeration.

### Required Fix
1. Open `/home/user/GroveAuth/src/routes/session.ts`
2. Import and apply the existing rate limiter:

```typescript
import { rateLimit } from '../middleware/rateLimit';

// At the start of the session router definition
session.use('*', async (c, next) => {
  // Rate limit by user ID from session cookie
  const sessionCookie = c.req.header('Cookie')?.match(/grove_session=([^;]+)/)?.[1];
  const identifier = sessionCookie || c.req.header('CF-Connecting-IP') || 'unknown';

  const limited = await rateLimit(c.env, {
    key: `session:${identifier}`,
    limit: 30,       // 30 requests
    window: 60,      // per minute
  });

  if (limited) {
    return c.json({ error: 'rate_limit_exceeded' }, 429);
  }

  await next();
});
```

3. Apply stricter limits to sensitive operations:

```typescript
// Before revoke-all endpoint
session.post('/revoke-all', async (c) => {
  const limited = await rateLimit(c.env, {
    key: `revoke-all:${userId}`,
    limit: 3,        // 3 requests
    window: 3600,    // per hour
  });

  if (limited) {
    return c.json({ error: 'rate_limit_exceeded' }, 429);
  }
  // ... rest of handler
});
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify normal usage works
- [ ] Load test: Send rapid requests, verify rate limiting kicks in

### Commit Message
```
fix(security): add rate limiting to session management endpoints

Session endpoints now have rate limiting to prevent DoS and
enumeration attacks. General limit is 30/min, with stricter
limits on destructive operations like revoke-all.
```

---

## Task DATA-008: Add Rate Limiting to Admin Routes

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/routes/admin.ts` (lines 49-99)
**Category**: Data / Rate Limiting

### Problem
Admin routes have no rate limiting. An attacker with valid admin credentials could enumerate all users, audit logs, and other sensitive data rapidly.

### Required Fix
1. Open `/home/user/GroveAuth/src/routes/admin.ts`
2. Add rate limiting middleware:

```typescript
import { rateLimit } from '../middleware/rateLimit';

// Apply rate limiting to all admin routes
admin.use('*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const identifier = token ? `admin:${token.substring(0, 16)}` : 'admin:unknown';

  const limited = await rateLimit(c.env, {
    key: identifier,
    limit: 100,      // 100 requests
    window: 60,      // per minute
  });

  if (limited) {
    return c.json({ error: 'rate_limit_exceeded' }, 429);
  }

  await next();
});
```

3. Also add pagination limits to prevent large data dumps:

```typescript
// In GET /admin/users handler
const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50'), 1), 100);
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify admin operations work normally
- [ ] Load test: Verify rate limiting engages

### Commit Message
```
fix(security): add rate limiting to admin routes

Admin endpoints now have rate limiting (100/min) and pagination
caps (max 100 records) to prevent rapid enumeration of sensitive
data even with valid admin credentials.
```

---

## Task SECRETS-002: Move Admin Emails to Environment Configuration

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/types.ts` (line 365), `/home/user/GroveAuth/src/db/seed.sql` (line 50)
**Category**: Secrets / Configuration

### Problem
Admin email addresses are hardcoded in source code, exposing them publicly and requiring code changes to modify admin access.

### Current Code
```typescript
// src/types.ts line 365
export const ADMIN_EMAILS = ['autumn@grove.place', 'autumnbrown23@pm.me'];
```

### Required Fix
1. Remove hardcoded array from `/home/user/GroveAuth/src/types.ts`
2. Add admin check to use database or environment:

```typescript
// In src/types.ts - Replace hardcoded array with:
export function isAdminEmail(email: string, env: Env): boolean {
  // Option A: Environment variable (comma-separated)
  const adminEmails = env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());

  // Option B: Check database user.is_admin flag
  // This would require an async lookup
}
```

3. Add `ADMIN_EMAILS` to wrangler.toml as a secret:
```bash
wrangler secret put ADMIN_EMAILS
# Enter: autumn@grove.place,autumnbrown23@pm.me
```

4. Update all code that references `ADMIN_EMAILS` to use the new function
5. Remove email from seed.sql or replace with placeholder

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify admin check still works
- [ ] Grep for hardcoded emails: `grep -r "autumnbrown23" src/` returns nothing

### Commit Message
```
fix(security): move admin emails from source code to environment

Admin email addresses are no longer hardcoded in source code.
They are now configured via the ADMIN_EMAILS environment variable
or database flag, preventing public exposure and enabling changes
without code deployment.
```

---

## Task INJ-002: Add Path Traversal Validation to CDN Upload

**Severity**: Medium
**File(s)**: `/home/user/GroveAuth/src/routes/cdn.ts` (lines 127, 153-154)
**Category**: Injection / Path Traversal

### Problem
The `folder` parameter from user input is not validated for path traversal sequences. An attacker could submit `folder: "../../sensitive"` to potentially write files outside the intended directory.

### Current Code
```typescript
// Line 127
const folder = (formData.get('folder') as string) || '/';

// Lines 153-154
const normalizedFolder = folder.startsWith('/') ? folder.substring(1) : folder;
const key = normalizedFolder ? `${normalizedFolder}/${sanitizedFilename}` : sanitizedFilename;
```

### Required Fix
1. Open `/home/user/GroveAuth/src/routes/cdn.ts`
2. Add folder validation function:

```typescript
function validateFolder(folder: string): { valid: boolean; normalized: string } {
  // Reject dangerous patterns
  if (folder.includes('..') ||
      folder.includes('\\') ||
      folder.includes('\0') ||
      folder.includes('//')) {
    return { valid: false, normalized: '' };
  }

  // Only allow alphanumeric, dash, underscore, dot, and forward slash
  if (!/^[a-zA-Z0-9._\/-]*$/.test(folder)) {
    return { valid: false, normalized: '' };
  }

  // Normalize: remove leading/trailing slashes
  const normalized = folder.replace(/^\/+|\/+$/g, '');

  return { valid: true, normalized };
}
```

3. Apply validation before using folder:

```typescript
// After line 127
const folder = (formData.get('folder') as string) || '';
const validation = validateFolder(folder);

if (!validation.valid) {
  return c.json({ error: 'invalid_folder', error_description: 'Folder contains invalid characters' }, 400);
}

const key = validation.normalized
  ? `${validation.normalized}/${sanitizedFilename}`
  : sanitizedFilename;
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify normal folder paths work
- [ ] Security test: Attempt path traversal, verify rejection

### Commit Message
```
fix(security): add path traversal validation to CDN folder parameter

CDN upload now validates the folder parameter for path traversal
sequences (.., \, null bytes) and restricts to safe characters.
This prevents writing files outside the intended directory.
```

---

## Task DATA-007: Remove PII from JWT Claims

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/services/jwt.ts` (lines 46-54)
**Category**: Data / PII Exposure

### Problem
JWT access tokens contain email and name claims. JWTs are base64-encoded (not encrypted), so this PII is visible to anyone who intercepts or receives the token.

### Required Fix
1. Open `/home/user/GroveAuth/src/services/jwt.ts`
2. Remove email and name from token payload:

```typescript
// Lines 46-54 - Remove email and name claims
const payload: JWTPayload = {
  iss: issuer,
  sub: userId,
  aud: clientId,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + expiresIn,
  // REMOVED: email, name - fetch from /userinfo endpoint instead
};
```

3. Ensure `/userinfo` endpoint exists and returns user details securely
4. Update any clients that rely on email/name in JWT to use /userinfo instead

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Decode JWT and verify no email/name present
- [ ] Manual test: Verify /userinfo endpoint returns user data

### Commit Message
```
fix(security): remove PII (email, name) from JWT claims

Access tokens no longer contain email and name claims. Clients
should fetch user details from the /userinfo endpoint. This
prevents PII exposure through token interception or logging.
```

---

# P2 - Medium Priority Tasks

---

## Task AUTH-004: Require code_challenge_method in PKCE Flow

**Severity**: High
**File(s)**: `/home/user/GroveAuth/src/routes/token.ts` (lines 182-196)
**Category**: Auth / PKCE

### Problem
When a code_challenge is present, the code_challenge_method defaults to S256 if not provided. This could allow method confusion attacks.

### Required Fix
1. Open `/home/user/GroveAuth/src/routes/token.ts`
2. Make code_challenge_method required when code_challenge is present:

```typescript
// Around line 182-196
if (authCode.code_challenge) {
  if (!authCode.code_challenge_method) {
    return c.json({
      error: 'invalid_request',
      error_description: 'code_challenge_method required when code_challenge is present'
    }, 400);
  }

  const valid = await verifyCodeChallenge(
    code_verifier,
    authCode.code_challenge,
    authCode.code_challenge_method
  );

  if (!valid) {
    return c.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
  }
}
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify PKCE flow works with both parameters
- [ ] Manual test: Verify error when code_challenge provided without method

### Commit Message
```
fix(security): require code_challenge_method when code_challenge present

PKCE validation now requires explicit code_challenge_method instead
of defaulting to S256. This prevents potential method confusion attacks.
```

---

## Task INJ-003: Escape Script Context in Login Template

**Severity**: Medium
**File(s)**: `/home/user/GroveAuth/src/templates/login.ts` (lines 420-424)
**Category**: Injection / XSS

### Problem
Parameters are serialized into a JavaScript literal using JSON.stringify. While this provides some protection, characters like `</script>` could break out of the script context.

### Current Code
```typescript
const params = ${JSON.stringify({
  client_id: params.client_id,
  redirect_uri: params.redirect_uri,
  state: params.state,
})};
```

### Required Fix
1. Open `/home/user/GroveAuth/src/templates/login.ts`
2. Add script context escaping:

```typescript
function escapeForScriptContext(str: string): string {
  return str
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e')
    .replace(/&/g, '\\x26')
    .replace(/'/g, '\\x27')
    .replace(/"/g, '\\x22');
}

// Lines 420-424 - Replace with:
const paramsJson = JSON.stringify({
  client_id: params.client_id,
  redirect_uri: params.redirect_uri,
  state: params.state,
});
const escapedParams = escapeForScriptContext(paramsJson);

// In template:
const params = ${escapedParams};
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify login page works correctly
- [ ] Security test: Include `</script>` in parameters, verify no script breakout

### Commit Message
```
fix(security): escape script context in login template

JSON parameters in script tags now escape <, >, &, ', and " to
prevent potential script context breakout attacks.
```

---

## Task API-003: Remove Internal URLs from Error Messages

**Severity**: Medium
**File(s)**: `/home/user/GroveAuth/src/routes/minecraft.ts`
**Category**: API / Information Disclosure

### Problem
The Minecraft proxy returns error responses that may expose internal URLs and system details.

### Required Fix
1. Open `/home/user/GroveAuth/src/routes/minecraft.ts`
2. Replace detailed error messages with generic ones:

```typescript
// Replace detailed error responses:
return c.json({
  error: 'proxy_error',
  error_description: `mc-control returned non-JSON: ${text.substring(0, 200)}`,  // REMOVE
}, 502);

// With:
return c.json({
  error: 'proxy_error',
  error_description: 'Upstream service returned invalid response',
}, 502);

// Log details internally:
console.error('[Minecraft Proxy] Invalid response from upstream:', response.status);
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Trigger error, verify no internal URLs exposed
- [ ] Verify detailed errors logged server-side

### Commit Message
```
fix(security): remove internal URLs from Minecraft proxy error messages

Error responses now return generic messages instead of exposing
internal service URLs and response content. Details are logged
server-side only.
```

---

## Task DO-010: Reduce Session Timeout from 30 Days

**Severity**: Medium
**File(s)**: `/home/user/GroveAuth/src/lib/session.ts` (line 135)
**Category**: Durable Objects / Session Security

### Problem
The default session timeout is 30 days, which is excessive for an authentication service. Longer sessions increase the window of opportunity for session hijacking.

### Required Fix
1. Open `/home/user/GroveAuth/src/lib/session.ts`
2. Reduce default session timeout:

```typescript
// Line 135 - Change from 30 days to 7-14 days
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;  // 7 days in seconds

// Or make configurable:
const SESSION_MAX_AGE = parseInt(env.SESSION_MAX_AGE || '604800');  // Default 7 days
```

3. Consider shorter timeout for admin sessions:
```typescript
const ADMIN_SESSION_MAX_AGE = 4 * 60 * 60;  // 4 hours for admin
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify session creation with new timeout
- [ ] Verify cookie Max-Age matches new timeout

### Commit Message
```
fix(security): reduce session timeout from 30 days to 7 days

Session timeout reduced to limit window of opportunity for session
hijacking. Admin sessions should have even shorter timeouts.
```

---

## Task INJ-004: Remove Incomplete sanitizeString Function

**Severity**: Low
**File(s)**: `/home/user/GroveAuth/src/utils/validation.ts` (lines 78-81)
**Category**: Injection / Code Quality

### Problem
The `sanitizeString()` function is incomplete (only removes < and >) and unused. Its presence could lead developers to use it thinking it's safe.

### Current Code
```typescript
export function sanitizeString(input: string): string {
  return input.replace(/[<>]/g, '').trim();
}
```

### Required Fix
1. Open `/home/user/GroveAuth/src/utils/validation.ts`
2. Either remove the function entirely, or replace with proper implementation:

Option A - Remove:
```typescript
// Delete lines 78-81
```

Option B - Replace with proper HTML escaping:
```typescript
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Grep for usage: `grep -r "sanitizeString" src/` returns nothing (if removed)

### Commit Message
```
fix(security): remove incomplete sanitizeString function

The sanitizeString function was incomplete and unused. Removed to
prevent accidental use. Use escapeHtml for proper HTML escaping.
```

---

## Task DEP-001: Update Frontend Dependencies for Cookie Vulnerability

**Severity**: Low
**File(s)**: `/home/user/GroveAuth/frontend/package.json`
**Category**: Dependencies

### Problem
The cookie package (transitive dependency via @sveltejs/kit) has a LOW severity vulnerability related to out-of-bounds character handling.

### Required Fix
1. Navigate to frontend directory and update @sveltejs/kit:

```bash
cd /home/user/GroveAuth/frontend
pnpm update @sveltejs/kit
pnpm audit
```

2. Verify the cookie dependency is updated to >=0.7.0

### Verification
- [ ] `pnpm audit` shows no vulnerabilities
- [ ] `pnpm build` succeeds
- [ ] Frontend application works correctly

### Commit Message
```
chore(deps): update @sveltejs/kit to fix cookie vulnerability

Updates @sveltejs/kit to resolve GHSA-pxg6-pf52-xh8x in the
transitive cookie dependency.
```

---

## Task API-002: Add Rate Limiting to Better Auth Routes

**Severity**: Medium
**File(s)**: `/home/user/GroveAuth/src/auth/index.ts` (lines 118-123)
**Category**: API / Rate Limiting

### Problem
Better Auth's built-in rate limiting is disabled, but the `/api/auth/*` endpoints are not protected by custom rate limiters.

### Required Fix
1. Open `/home/user/GroveAuth/src/auth/index.ts`
2. Add rate limiting middleware before the Better Auth handler:

```typescript
import { rateLimit } from '../middleware/rateLimit';

// Before the Better Auth handler
app.use('/api/auth/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  const limited = await rateLimit(c.env, {
    key: `better-auth:${ip}`,
    limit: 60,       // 60 requests
    window: 60,      // per minute
  });

  if (limited) {
    return c.json({ error: 'rate_limit_exceeded' }, 429);
  }

  await next();
});
```

### Verification
- [ ] Run `pnpm check` - no TypeScript errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Manual test: Verify auth endpoints work normally
- [ ] Load test: Verify rate limiting engages

### Commit Message
```
fix(security): add rate limiting to Better Auth endpoints

Better Auth routes now have rate limiting (60/min per IP) since
the built-in rate limiting is disabled. This prevents brute force
attacks on authentication endpoints.
```

---

# Task Summary by File

For efficient implementation, here are tasks grouped by file:

## `/home/user/GroveAuth/src/routes/subscription.ts`
- API-001: Add authorization checks (Critical)

## `/home/user/GroveAuth/src/routes/oauth/google.ts`
- AUTH-001: Remove PII from redirect URLs (Critical)

## `/home/user/GroveAuth/src/auth/index.ts`
- DATA-001: Remove email logging (Critical)
- API-002: Add rate limiting (Medium)

## `/home/user/GroveAuth/src/utils/crypto.ts`
- DATA-004: Replace SHA-256 with PBKDF2 (Critical)

## `/home/user/GroveAuth/src/lib/server/session.ts`
- DATA-003: Encrypt/filter KV cache (Critical)

## `/home/user/GroveAuth/src/durables/SessionDO.ts`
- DO-002: Add authorization checks (Critical)

## `/home/user/GroveAuth/src/db/seed.sql`
- SECRETS-001: Remove/rotate client secrets (Critical)

## `/home/user/GroveAuth/src/routes/session.ts`
- DO-004: Add rate limiting (High)

## `/home/user/GroveAuth/src/routes/admin.ts`
- DATA-008: Add rate limiting and pagination caps (High)

## `/home/user/GroveAuth/src/lib/session.ts`
- DO-007: Change SameSite to Strict (High)
- DO-008: Remove userId from cookie (High)
- DO-010: Reduce session timeout (Medium)

## `/home/user/GroveAuth/src/middleware/cors.ts`
- AUTH-003: Fix CORS validation (High)

## `/home/user/GroveAuth/src/routes/token.ts`
- AUTH-004: Require code_challenge_method (High)
- AUTH-005: Fix race condition (High)

## `/home/user/GroveAuth/src/templates/settings.ts`
- INJ-001: Fix DOM XSS (High)

## `/home/user/GroveAuth/src/services/jwt.ts`
- DATA-007: Remove PII from JWT (High)

## `/home/user/GroveAuth/src/types.ts`
- SECRETS-002: Move admin emails to env (High)

## `/home/user/GroveAuth/src/routes/cdn.ts`
- INJ-002: Add path traversal validation (Medium)

## `/home/user/GroveAuth/src/templates/login.ts`
- INJ-003: Escape script context (Medium)

## `/home/user/GroveAuth/src/routes/minecraft.ts`
- API-003: Remove internal URLs from errors (Medium)

## `/home/user/GroveAuth/src/utils/validation.ts`
- INJ-004: Remove incomplete sanitizeString (Low)

---

*Remediation Plan generated by Security Audit Agent - Phase 1 Consolidation*
