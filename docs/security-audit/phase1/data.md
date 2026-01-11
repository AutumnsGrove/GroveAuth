# Security Audit: Data Handling & Storage

## Executive Summary

The GroveAuth authentication service handles sensitive PII including emails, names, avatars, IP addresses, and session tokens. The audit identified significant issues related to PII exposure, inadequate encryption, and data leakage.

### Severity Summary
- **Critical:** 5 findings
- **High:** 6 findings
- **Medium:** 7 findings
- **Low:** 3 findings

---

## Critical Findings

### 1. PII Exposed in OAuth Callback Redirect URLs

**File:** `/home/user/GroveAuth/src/routes/oauth/google.ts` (Lines 274-287)

**Issue:** User email and ID are exposed in URL parameters:

```typescript
function buildInternalServiceRedirect(...) {
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('user_id', userId);
  url.searchParams.set('email', email);  // Email exposed in URL
  ...
}
```

**Risk:** Email (PII) transmitted in plaintext URL query parameters, logged by servers, visible in browser history.

**Recommendation:** Pass user info via POST body with secure session cookie only.

---

### 2. Email Logged to Console and Audit Logs

**File:** `/home/user/GroveAuth/src/auth/index.ts` (Lines 253, 290, 297, 300)

**Issue:** Email addresses logged to console:

```typescript
console.log(`[MagicLink] Sent magic link to ${email}`);
console.log(`[Auth] Public signup enabled - creating user: ${user.email}`);
```

**Risk:** Console logs visible to developers and CI/CD. Email is PII under GDPR/CCPA.

**Recommendation:** Never log emails to console. Hash emails in audit logs.

---

### 3. OAuth Provider Tokens Stored Unencrypted

**File:** `/home/user/GroveAuth/src/db/auth.schema.ts` (Lines 87-94)

**Issue:** Better Auth schema stores OAuth tokens without encryption:

```typescript
accessToken: text('access_token'),        // UNENCRYPTED
refreshToken: text('refresh_token'),      // UNENCRYPTED
idToken: text('id_token'),                // UNENCRYPTED
```

**Risk:** OAuth tokens can access user provider accounts. No encryption at rest.

**Recommendation:** Encrypt tokens at rest using field-level encryption.

---

### 4. Session Data with PII Cached in KV Store (Plaintext)

**File:** `/home/user/GroveAuth/src/lib/server/session.ts` (Lines 226-228)

**Issue:** Full session data including user info cached in plaintext KV:

```typescript
await env.SESSION_KV.put(cacheKey, JSON.stringify(sessionData), {
  expirationTtl: SESSION_CACHE_TTL,
});
```

**Risk:** User email/name stored plaintext in KV cache accessible by all Workers.

**Recommendation:** Cache only session metadata. Encrypt sensitive fields.

---

### 5. Insufficient Token Hashing Algorithm

**File:** `/home/user/GroveAuth/src/utils/crypto.ts` (Lines 96-106)

**Issue:** Tokens hashed using SHA-256, not a proper key derivation function:

```typescript
export async function hashSecret(secret: string): Promise<string> {
  return sha256Base64Url(secret);
}
```

**Risk:** SHA-256 is not password hashing. No salt, no iteration count.

**Recommendation:** Use Argon2id or PBKDF2 with salt and high iteration count.

---

## High Findings

### 6. Email Enumeration via Error Messages

**File:** `/home/user/GroveAuth/src/routes/magic.ts` (Lines 180-189)

**Issue:** Account locked status reveals email existence.

**Recommendation:** Always return same response for invalid email/code.

---

### 7. User Data Returned Without Authorization Checks

**File:** `/home/user/GroveAuth/src/routes/subscription.ts` (Lines 56-76)

**Issue:** Any authenticated user can retrieve any user's subscription data:

```typescript
const userId = c.req.param('userId');
const sub = await getUserSubscription(db, userId);  // No ownership check!
```

**Recommendation:** Add `if (payload.sub !== userId) return 403`.

---

### 8. Admin Routes Return Sensitive User Data

**File:** `/home/user/GroveAuth/src/routes/admin.ts` (Lines 77-85)

**Issue:** `GET /admin/users` returns all user data without filtering sensitive fields.

**Recommendation:** Filter sensitive fields, mask emails.

---

### 9. JWT Contains PII (Email and Name)

**File:** `/home/user/GroveAuth/src/services/jwt.ts` (Lines 46-54)

**Issue:** Access tokens contain email and name claims (visible in base64).

**Recommendation:** Only include `sub` (user ID). Fetch user details from `/userinfo`.

---

### 10. No Rate Limiting on /admin Routes

**File:** `/home/user/GroveAuth/src/routes/admin.ts` (Lines 49-99)

**Issue:** Admin routes have no rate limiting, can enumerate all users/logs.

**Recommendation:** Add rate limiting and cap pagination limits.

---

### 11. Multi-Tenant Row-Level Security Not Enforced

**Issue:** Schema includes `tenantId` but queries don't filter by tenant.

**Recommendation:** Add tenant filtering to all queries.

---

## Medium Findings

### 12. IP Addresses and User Agents Logged

**File:** `/home/user/GroveAuth/src/db/auth.schema.ts`

**Issue:** Session and audit tables store IP and User Agent unencrypted.

**Recommendation:** Hash IP addresses, anonymize user agent.

---

### 13. Magic Code Weakness

**File:** `/home/user/GroveAuth/src/utils/crypto.ts` (Lines 24-30)

**Issue:** Magic codes are 6-digit numeric (only 1M possibilities).

**Recommendation:** Use 8-digit or alphanumeric codes.

---

### 14. Failed Attempts Table Stores Email Unencrypted

**Recommendation:** Hash email when storing.

---

### 15. No Audit Log Retention Policy

**Issue:** Audit logs accumulate indefinitely.

**Recommendation:** Add cleanup job for logs older than 90 days.

---

### 16. Rate Limiting Keys May Expose Patterns

**Issue:** Rate limit keys use plaintext email.

**Recommendation:** Hash email as key.

---

### 17. Client Secret Hash Not Using Proper Hashing

**Recommendation:** Use PBKDF2 or Argon2 for client secret storage.

---

### 18. Console Error Logging Exposes Sensitive Data

**Recommendation:** Log only generic error messages in production.

---

## Low Findings

### 19. Unencrypted Data in Browser Redirect

Auth codes in redirect URLs. Mitigated by short expiry and single use.

### 20. No Data Classification/Tagging

Database schema doesn't mark sensitive columns.

### 21. Session Cookie Security Headers Not Comprehensive

Verify all security attributes are set.

---

## Positive Findings

1. **PKCE Support** - OAuth flows use PKCE with S256 method
2. **Rate Limiting** - Implemented on magic code, token, and refresh endpoints
3. **Account Lockout** - Failed attempt tracking with exponential backoff
4. **Token Rotation** - Refresh token rotation on use
5. **Timing-Safe Comparison** - Used for token verification
6. **Secure Code Generation** - Cryptographically secure random
7. **JWT Issuer Verification** - Tokens verified with issuer check
8. **Authorization Code Validation** - Comprehensive checks
9. **CORS Validation** - Dynamic based on registered origins
10. **Admin Access Protection** - Routes require Bearer token + admin flag
11. **Audit Logging** - Comprehensive logging of auth events
12. **Email Allowlist** - Blocks unauthorized signups
13. **Session Isolation** - Sessions per user and device

---

## Recommendations Summary

### Immediate Actions (Critical)
1. Remove email and user_id from OAuth callback redirect URLs
2. Stop logging emails to console
3. Implement field-level encryption for OAuth tokens
4. Replace SHA-256 token hashing with Argon2/PBKDF2
5. Encrypt or filter sensitive data cached in KV

### Short Term (High)
1. Add authorization checks to `/subscription/:userId` routes
2. Filter sensitive fields from admin API responses
3. Implement rate limiting on `/admin/*` routes
4. Remove email/name from JWT claims

### Medium Term
1. Implement data retention policy
2. Hash IP addresses and emails in rate limiting keys
3. Enforce tenant-based row-level security
4. Increase magic code entropy

---

## Files Requiring Changes

**Priority 1 (Critical):**
- `/home/user/GroveAuth/src/routes/oauth/google.ts`
- `/home/user/GroveAuth/src/auth/index.ts`
- `/home/user/GroveAuth/src/routes/magic.ts`
- `/home/user/GroveAuth/src/utils/crypto.ts`
- `/home/user/GroveAuth/src/lib/server/session.ts`

**Priority 2 (High):**
- `/home/user/GroveAuth/src/routes/subscription.ts`
- `/home/user/GroveAuth/src/routes/admin.ts`
- `/home/user/GroveAuth/src/services/jwt.ts`
- `/home/user/GroveAuth/src/db/queries.ts`
