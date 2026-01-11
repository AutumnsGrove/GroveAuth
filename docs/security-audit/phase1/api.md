# Security Audit: API Surface & Endpoints

## Executive Summary

**Total Findings: 14**
- Critical: 1
- High: 2
- Medium: 6
- Low: 5

The API implements strong authentication patterns with PKCE support, JWT tokens, and rate limiting on key endpoints. However, several critical authorization bypasses exist in subscription endpoints, and CORS validation is incomplete.

---

## Critical Findings

### 1. Authorization Bypass in Subscription Endpoints

**Severity:** Critical (CVSS 9.1)
**File:** `/home/user/GroveAuth/src/routes/subscription.ts`
**Lines:** 56-76, 98-139, 145-184

**Issue:** Subscription endpoints do not verify user ownership:

```typescript
subscription.get('/:userId', async (c) => {
  const payload = await verifyBearerToken(c);
  if (!payload) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const userId = c.req.param('userId');
  const sub = await getUserSubscription(db, userId);  // No ownership check!
});
```

A user with a valid token can:
- Read any user's subscription data
- Modify any user's post count
- Update any user's subscription tier

**Recommendation:**
```typescript
if (payload.sub !== requestedUserId && !isAdminUser) {
  return c.json({ error: 'forbidden' }, 403);
}
```

---

## High Findings

### 2. CORS Configuration Not Validated Against Client Registry

**File:** `/home/user/GroveAuth/src/middleware/cors.ts` (lines 36-53)

**Issue:** Hardcoded CORS whitelist instead of validating against database:

```typescript
// For now, allow *.grove.place origins
// In production, validate against client.allowed_origins // NOT DONE
if (origin.endsWith('.grove.place') || origin === 'https://autumnsgrove.place') {
  headers['Access-Control-Allow-Origin'] = origin;
}
```

**Risk:** Any subdomain on `.grove.place` gets CORS access.

**Recommendation:** Use `validateOriginForClient()` function properly.

---

### 3. Missing Authorization Check on GET /subscription/:userId

**File:** `/home/user/GroveAuth/src/routes/subscription.ts` (Lines 54-76)

**Issue:** `getUserSubscription()` called with user-provided `:userId` without ownership check.

**Recommendation:** Add ownership/admin check before returning data.

---

## Medium Findings

### 4. Admin Access Based on Hardcoded Email List

**File:** `/home/user/GroveAuth/src/types.ts` (line 365)

**Issue:**
```typescript
export const ADMIN_EMAILS = ['autumn@grove.place', 'autumnbrown23@pm.me'];
```

**Risk:** Adding/removing admins requires code changes and redeploy.

**Recommendation:** Manage admin status exclusively through database.

---

### 5. Session Cookie SameSite Too Permissive

**Files:** Multiple session handling files

**Issue:** Session cookies set with `SameSite=Lax`.

**Recommendation:** Change to `SameSite=Strict`.

---

### 6. Better Auth Integration Missing Rate Limiting

**File:** `/home/user/GroveAuth/src/auth/index.ts` (lines 118-123)

**Issue:** Better Auth's built-in rate limiting is disabled, but `/api/auth/*` endpoints not protected by custom rate limiters.

**Recommendation:** Add rate limiting middleware to Better Auth routes.

---

### 7. Minecraft Proxy Exposes Internal URLs in Error Messages

**File:** `/home/user/GroveAuth/src/routes/minecraft.ts`

**Issue:**
```typescript
return c.json({
  error: 'proxy_error',
  error_description: `mc-control returned non-JSON: ${text.substring(0, 200)}`,
}, 502);
```

**Recommendation:** Return generic error messages, log details internally.

---

### 8. Subscription Endpoints Missing Rate Limiting

**File:** `/home/user/GroveAuth/src/routes/subscription.ts`

**Issue:** No rate limiting on subscription endpoints.

**Recommendation:** Add rate limiting protection.

---

### 9. Complex Session Fallback Logic

**File:** `/home/user/GroveAuth/src/routes/session.ts` (lines 40-138)

**Issue:** Three different session mechanisms with fallback chain increases complexity and potential for bugs.

**Recommendation:** Set deprecation timeline for legacy methods.

---

## Low Findings

### 10. Query Parameter Bounds Not Validated on Admin Endpoints

**File:** `/home/user/GroveAuth/src/routes/admin.ts`

**Issue:**
```typescript
const limit = parseInt(c.req.query('limit') || '50');  // No bounds check
```

**Recommendation:** `Math.min(Math.max(parseInt(...), 1), 1000)`

---

### 11. Root Endpoint Exposes Complete API Documentation

**File:** `/home/user/GroveAuth/src/index.ts` (lines 92-175)

**Issue:** `GET /` returns detailed API documentation.

**Recommendation:** Return minimal documentation or require auth.

---

### 12. OAuth State Expiry Hardcoded

**File:** `/home/user/GroveAuth/src/routes/oauth/google.ts` (line 75)

**Issue:** Fixed 10-minute expiry makes it difficult to tune.

**Recommendation:** Make configurable via environment variable.

---

### 13. Admin Endpoint Exposes Client Configuration Details

**File:** `/home/user/GroveAuth/src/routes/admin.ts`

**Issue:** Returns redirect_uris and allowed_origins.

**Recommendation:** Only show to client owner via separate endpoint.

---

### 14. Form Data Parsing Not Validating Content-Type

**Files:** `/home/user/GroveAuth/src/routes/token.ts`, `magic.ts`

**Issue:** Accepts form data without validating Content-Type header.

**Recommendation:** Validate Content-Type is `application/x-www-form-urlencoded`.

---

## Positive Findings

1. **PKCE Implementation** - OAuth 2.0 PKCE flow properly implemented
2. **Strong Rate Limiting** - Comprehensive rate limiting on auth endpoints
3. **Account Lockout Protection** - Failed magic code attempts trigger lockout
4. **JWT Signing with RS256** - Asymmetric encryption
5. **Proper Client Secret Validation** - All sensitive endpoints validate credentials
6. **Audit Logging** - Auth events logged with IP, user agent, event type
7. **Session Management** - Modern Durable Object-based sessions
8. **Security Headers** - HSTS, X-Content-Type-Options, X-Frame-Options, CSP
9. **Token Validation** - Proper JWT verification on protected endpoints
10. **Input Validation** - Zod schema validation on all request payloads
11. **Email Enumeration Protection** - Consistent responses for invalid emails
12. **Email Allowlist** - Proper enforcement for user authentication
13. **Redirect URI Validation** - Validated against registered URIs
14. **Refresh Token Rotation** - Proper token rotation on refresh
15. **Cookie Security Attributes** - HttpOnly, Secure flags set

---

## Recommendations Summary

**Immediate Actions (Critical):**
1. Fix authorization bypass in subscription endpoints
2. Implement proper CORS validation against client registry
3. Add rate limiting to Better Auth endpoints

**Short Term (High Priority):**
1. Migrate admin access to database-driven model
2. Change session cookie SameSite from Lax to Strict
3. Remove internal URLs from error messages
4. Add rate limiting to subscription endpoints

**Medium Term:**
1. Add bounds validation to pagination parameters
2. Simplify session validation fallback chain
3. Move hardcoded values to environment configuration
