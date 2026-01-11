# Security Audit: Authentication & Session Management

## Executive Summary

The GroveAuth authentication service demonstrates solid security fundamentals with PKCE, JWT signing, rate limiting, and session management. However, several vulnerabilities have been identified that should be addressed before production deployment.

**Severity Summary:**
- **Critical:** 2 findings
- **High:** 5 findings
- **Medium:** 7 findings
- **Low:** 4 findings

---

## Critical Findings

### 1. Session Token Leakage in URL Parameters

**File:** `/home/user/GroveAuth/src/routes/oauth/google.ts` (lines 274-287)

**Issue:** For internal Grove services, session tokens are passed as URL query parameters instead of secure HTTP-only cookies:

```typescript
function buildInternalServiceRedirect(
  redirectUri: string,
  sessionToken: string,
  userId: string,
  email: string,
  state: string
): string {
  const url = new URL(redirectUri);
  url.searchParams.set('session_token', sessionToken);  // VULNERABILITY
  url.searchParams.set('user_id', userId);
  url.searchParams.set('email', email);
  url.searchParams.set('state', state);
  return url.toString();
}
```

**Risk:** Session tokens in URLs can be:
- Logged by web servers, proxies, and CDNs
- Visible in browser history
- Captured by network monitoring tools
- Leaked through Referer headers

**Recommendation:** Use secure HTTP-only cookies (already set at line 220) instead of URL parameters. Remove session_token, user_id, and email from URL parameters.

---

### 2. Redirect with Set-Cookie Header in 302 Response

**File:** `/home/user/GroveAuth/src/routes/oauth/google.ts` (lines 216-223)

**Issue:** Session cookie is set via Set-Cookie header in a 302 redirect response:

```typescript
return new Response(null, {
  status: 302,
  headers: {
    Location: redirect,
    'Set-Cookie': sessionCookieHeader,  // May not be processed in redirect
  },
});
```

**Risk:**
- Some browsers/clients may not process Set-Cookie headers in redirect responses
- The session token in the URL becomes primary authentication method
- Cookie might not be set, leaving only URL-based token as fallback

**Recommendation:** Set the session cookie in the initial response before redirect, or use POST-to-GET pattern with secure session storage.

---

## High Findings

### 3. CORS Policy Not Using Registered Client Origins

**File:** `/home/user/GroveAuth/src/middleware/cors.ts` (lines 36-53)

**Issue:** Hardcoded CORS whitelist instead of validating against registered client origins:

```typescript
if (origin.endsWith('.grove.place') || origin === 'https://autumnsgrove.place') {
  headers['Access-Control-Allow-Origin'] = origin;
}
```

**Risk:** Any subdomain of .grove.place can access auth endpoints. An attacker controlling a .grove.place subdomain could perform CSRF attacks.

**Recommendation:** Use the existing `validateOriginForClient()` function to validate against registered client origins.

---

### 4. Code Challenge Method Validation Missing

**File:** `/home/user/GroveAuth/src/routes/token.ts` (lines 182-196)

**Issue:** When PKCE code_challenge is present, method validation is incomplete:

```typescript
const valid = await verifyCodeChallenge(
  code_verifier,
  authCode.code_challenge,
  authCode.code_challenge_method || 'S256'  // Defaults to S256
);
```

**Risk:** If code_challenge_method is null/undefined, system assumes S256 which could allow method confusion.

**Recommendation:** Require code_challenge_method in validation schema and fail if not provided.

---

### 5. Potential Race Condition in Auth Code Consumption

**File:** `/home/user/GroveAuth/src/routes/token.ts` (lines 158-199)

**Issue:** Auth code validation and marking as used are separate operations:

```typescript
const authCode = await getAuthCode(db, code);
// ... validation checks ...
await markAuthCodeUsed(db, code);  // Separate DB call
```

**Risk:** Two concurrent requests with same auth code could both pass validation before marking as used.

**Recommendation:** Use database transactions to atomically fetch, validate, and mark code as used.

---

### 6. Incomplete Magic Code Cleanup

**File:** `/home/user/GroveAuth/src/routes/magic.ts` (line 213)

**Issue:** Magic codes are marked as used but may not be deleted, causing database bloat.

**Recommendation:** Implement automated cleanup of expired magic codes.

---

### 7. Account Lockout Logic Flaw

**File:** `/home/user/GroveAuth/src/routes/magic.ts` (lines 178-210)

**Issue:** Lock status checked before verification but not immediately before recording failed attempt.

**Risk:** Race condition allowing multiple requests after account locked.

**Recommendation:** Check lock status immediately before recording attempt.

---

## Medium Findings

### 8. Session Cookie Parsing Fragility

**File:** `/home/user/GroveAuth/src/routes/session.ts` (lines 110-122)

**Issue:** Manual regex-based cookie parsing could miss edge cases.

**Recommendation:** Use consistent cookie parsing approach across codebase.

---

### 9. Missing Auth Code Cleanup

Database accumulates expired auth codes without cleanup.

**Recommendation:** Implement scheduled cleanup job.

---

### 10. Timestamp Precision in Cookie Clearing

**File:** `/home/user/GroveAuth/src/routes/session.ts` (lines 158-162)

**Issue:** Multiple Set-Cookie headers with potentially inconsistent values.

**Recommendation:** Create helper functions for consistent cookie clearing.

---

### 11. Magic Code Strength

**File:** `/home/user/GroveAuth/src/utils/crypto.ts` (lines 24-30)

**Issue:** Magic codes are only 6 digits (1,000,000 possibilities).

**Mitigation:** Current rate limiting provides sufficient protection. Consider 8 digits for future.

---

### 12. Missing Request Validation on OAuth Endpoint

**File:** `/home/user/GroveAuth/src/routes/oauth/google.ts` (lines 36-93)

**Issue:** code_challenge_method validation happens too late.

**Recommendation:** Validate early that if code_challenge is provided, code_challenge_method must be provided.

---

### 13. Console Error Logging

**File:** `/home/user/GroveAuth/src/services/oauth.ts` (lines 64, 70, 87, 93)

**Issue:** Sensitive errors logged to console.

**Recommendation:** Don't log response body, only status code and error type.

---

### 14. Internal Service Session Token in Redirect

**File:** `/home/user/GroveAuth/src/routes/oauth/google.ts` (lines 204-223)

**Issue:** Different handling for internal services bypasses standard OAuth flow.

**Recommendation:** Don't use URL-based authentication for internal services.

---

## Low Findings

### 15. API Error Message Precision
Different error messages for different failure modes (code not found vs expired vs used).

### 16. Session DO Fallback Chain Complexity
Three different session mechanisms with fallback chain increases complexity.

### 17. Hardcoded Admin Emails
**File:** `/home/user/GroveAuth/src/types.ts` (line 365)
Admin emails should be in database or environment variables.

### 18. No Rate Limiting on /verify Endpoint
Could be used for token validation enumeration attacks.

---

## Positive Findings

1. **PKCE Implementation** - Proper code challenge/verifier validation
2. **JWT RS256 Signing** - Strong asymmetric algorithm
3. **Token Expiry Times** - Reasonable defaults (1hr access, 30d refresh)
4. **Timing-Safe Comparisons** - timingSafeEqual function prevents timing attacks
5. **Cookie Security Flags** - HttpOnly, Secure, SameSite=Lax properly set
6. **Refresh Token Rotation** - New token issued on refresh, old revoked
7. **OAuth State Validation** - State properly saved and validated
8. **HMAC Session Cookies** - Signed with HMAC-SHA256
9. **Comprehensive Rate Limiting** - Per-email, per-IP, per-client limits
10. **Email Allowlist** - Flexible access control
11. **Audit Logging** - All auth events logged
12. **Account Lockout** - 5 failed attempts → 15 minute lockout
13. **Security Headers** - CSP, HSTS, X-Frame-Options configured
14. **Session Revocation** - Ability to revoke all sessions
