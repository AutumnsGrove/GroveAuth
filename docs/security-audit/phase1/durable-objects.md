# Security Audit: Durable Objects

## Executive Summary

The Durable Objects implementation uses a SessionDO class for per-user session management with SQLite-backed persistence. The design provides good isolation between users via DO instances, but has several vulnerabilities related to session validation, input validation, and authorization.

**Severity Breakdown:**
- **Critical:** 3 findings
- **High:** 5 findings
- **Medium:** 3 findings
- **Low:** 0 findings

---

## Critical Findings

### 1. DO ID Derivation Vulnerability

**File:** `/home/user/GroveAuth/src/routes/session.ts` (lines 47-48, 151-152, 192-193, 214-215, 241-242, 265-266, 405-406)

**Issue:** SessionDO ID is derived directly from user ID:

```typescript
const sessionDO = c.env.SESSIONS.get(
  c.env.SESSIONS.idFromName(`session:${parsedSession.userId}`)
);
```

If `SESSION_SECRET` is compromised, an attacker could:
- Forge a valid session cookie for any user
- Access that user's SessionDO instance
- Read, modify, or delete their sessions

**Risk Assessment:** CRITICAL - Privilege escalation if SESSION_SECRET leaks.

**Recommendation:** Add explicit authorization check before accessing DO methods. Verify requester's session ID matches actual sessions.

---

### 2. Missing Authorization Checks in SessionDO Methods

**File:** `/home/user/GroveAuth/src/durables/SessionDO.ts` (lines 82-108, 113-152, 157-165, 170-186, 191-209)

**Issue:** SessionDO methods do not validate that the requester owns the sessions:

```typescript
async validateSession(sessionId: string, updateLastActive = true) {
  // No check that the caller owns this sessionId
  const result = await this.ctx.storage.sql
    .exec(`SELECT * FROM sessions WHERE id = ?`, sessionId)
    .toArray();
```

**Risk Assessment:** CRITICAL - Complete lack of authorization validation.

**Recommendation:** Add authorization checks within SessionDO methods (defense in depth).

---

### 3. Unused Rate Limiting Methods

**File:** `/home/user/GroveAuth/src/durables/SessionDO.ts` (lines 214-265, 270-285)

**Issue:** The `checkLoginRateLimit()` and `recordLoginAttempt()` methods are defined but never called anywhere.

**Risk Assessment:** CRITICAL - Incomplete security controls.

**Recommendation:** Implement the rate limiting or remove dead code.

---

## High Findings

### 4. No Rate Limiting on Session Management Endpoints

**File:** `/home/user/GroveAuth/src/routes/session.ts`

**Issue:** Session endpoints lack rate limiting:
- `POST /session/validate` - No rate limit
- `POST /session/revoke` - No rate limit
- `POST /session/revoke-all` - No rate limit
- `GET /session/list` - No rate limit
- `DELETE /session/:sessionId` - No rate limit

**Risk Assessment:** HIGH - DoS and enumeration attacks possible.

**Recommendation:** Add rate limiting before each operation.

---

### 5. revokeAllSessions Lacks Confirmation

**File:** `/home/user/GroveAuth/src/routes/session.ts` (lines 177-201)

**Issue:** Allows revoking all sessions without additional confirmation.

**Risk Assessment:** HIGH - Account lockout possible.

**Recommendation:** Require email confirmation or password re-entry.

---

### 6. Missing Input Validation on String Parameters

**File:** `/home/user/GroveAuth/src/durables/SessionDO.ts` (lines 82-108)

**Issue:** `createSession` doesn't validate parameter lengths:

```typescript
// No validation of params.deviceId, params.deviceName, params.ipAddress, params.userAgent
await this.ctx.storage.sql.exec(
  `INSERT INTO sessions ...`,
  params.deviceId,
  params.deviceName,
  ...
);
```

**Risk Assessment:** HIGH - Storage exhaustion attack.

**Recommendation:** Validate maximum lengths for all parameters.

---

### 7. Session Cookie SameSite Policy Too Permissive

**File:** `/home/user/GroveAuth/src/lib/session.ts` (line 138)

**Issue:** Session cookies use `SameSite=Lax`:

```typescript
return `grove_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; ...`;
```

**Risk Assessment:** HIGH - Potential CSRF attacks if GET requests modify state.

**Recommendation:** Change to `SameSite=Strict`.

---

### 8. Session Cookie Format Leaks User IDs

**File:** `/home/user/GroveAuth/src/lib/session.ts` (lines 68-76)

**Issue:** Session cookies contain userId in plaintext:

```typescript
const payload = `${sessionId}:${userId}`;
const signature = await hmacSign(payload, secret);
return `${payload}:${signature}`;
```

Cookie format: `{sessionId}:{userId}:{signature}` leaks user IDs.

**Risk Assessment:** HIGH - Information disclosure.

**Recommendation:** Use only sessionId with derived userId mapping in KV.

---

## Medium Findings

### 9. Missing Input Validation for sessionId Parameter

**File:** `/home/user/GroveAuth/src/routes/session.ts` (line 239)

**Issue:** `sessionId` from URL is not validated as valid UUID.

**Recommendation:** Validate UUID format before using.

---

### 10. Excessive Session Timeout (30 days)

**File:** `/home/user/GroveAuth/src/lib/session.ts` (line 135)

**Issue:** Default session timeout is 30 days.

**Recommendation:** Reduce to 7-14 days. Use shorter timeout for admin sessions.

---

### 11. Session Alarm Cleanup Not Rate-Limited

**File:** `/home/user/GroveAuth/src/durables/SessionDO.ts` (lines 341-368)

**Issue:** Alarm handler deletes expired sessions without batching.

**Recommendation:** Delete in batches to prevent resource exhaustion.

---

## Positive Findings

1. **HMAC-SHA256 Session Signing** - Proper cryptographic signing
2. **Timing-Safe Comparison** - Signature verification uses constant-time comparison
3. **Secure Cookie Attributes** - HttpOnly, Secure, and Domain attributes set
4. **Per-User DO Isolation** - Each user has their own SessionDO instance
5. **Automatic Session Cleanup** - Expired sessions cleaned via alarms
6. **SQLite Persistence** - ACID guarantees for session storage
7. **Proper Index Creation** - Indexes on expires_at and device_id
8. **Client Validation** - OAuth clients properly validated
9. **Rate Limiting on OAuth Endpoints** - Magic link and token endpoints rate limited
10. **Email Allowlist Enforcement** - Users checked against allowlist

---

## Recommendations Summary

**Immediate Actions (Critical):**
1. Add explicit authorization checks in SessionDO methods
2. Implement rate limiting on all session management endpoints
3. Implement the unused rate limiting methods or remove them
4. Change `SameSite=Lax` to `SameSite=Strict`

**Short-term (High Priority):**
1. Add input validation to `createSession` parameters
2. Refactor session cookie format to not leak user IDs
3. Add confirmation mechanism for `revokeAllSessions`
4. Validate sessionId format before using

**Medium-term:**
1. Reduce session timeout from 30 days to 7-14 days
2. Implement batch deletion in alarm handler
3. Add audit logging of all DO method calls
