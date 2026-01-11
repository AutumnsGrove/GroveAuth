# Grove Authentication Service - Security Audit Report

**Audit Date:** January 2026
**Audit Scope:** GroveAuth Authentication Service
**Classification:** Internal Security Assessment

---

## Executive Summary

The Grove Authentication Service (GroveAuth) provides OAuth 2.0, magic link authentication, and session management for the Grove ecosystem. This security audit examined authentication flows, data handling, session management, API endpoints, secrets management, and dependencies.

### Overall Security Posture: MODERATE RISK

The codebase demonstrates strong security fundamentals including PKCE implementation, JWT RS256 signing, comprehensive rate limiting on core auth endpoints, and proper input validation via Zod schemas. However, **11 Critical** and **19 High** severity findings were identified that require remediation before production deployment.

### Severity Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 11 | **Blocks Launch** |
| High | 19 | **Should Block Launch** |
| Medium | 21 | Address Soon |
| Low | 13 | Address When Convenient |
| **Total** | **64** | |

### Key Risk Areas

1. **Authorization Bypass** - Subscription endpoints lack ownership verification
2. **PII Exposure** - Email/user data in URLs, logs, and JWT tokens
3. **Session Security** - Cookie leaks user IDs, SameSite too permissive
4. **Secrets in Git** - Client secret hashes and admin emails committed
5. **Missing Rate Limiting** - Admin, session, and subscription endpoints unprotected

---

## Critical Findings Requiring Immediate Attention

| ID | Category | Description | File |
|----|----------|-------------|------|
| AUTH-001 | Auth | Session token and PII exposed in OAuth redirect URL parameters | `src/routes/oauth/google.ts:274-287` |
| AUTH-002 | Auth | Set-Cookie header in 302 redirect may not be processed | `src/routes/oauth/google.ts:216-223` |
| DATA-001 | Data | Email addresses logged to console (GDPR/CCPA violation) | `src/auth/index.ts:253,290,297,300` |
| DATA-002 | Data | OAuth provider tokens stored unencrypted in database | `src/db/auth.schema.ts:87-94` |
| DATA-003 | Data | Session data with PII cached in plaintext KV store | `src/lib/server/session.ts:226-228` |
| DATA-004 | Data | Token hashing uses SHA-256 instead of proper KDF | `src/utils/crypto.ts:96-106` |
| DO-001 | DO | SessionDO ID derived directly from user ID - privilege escalation risk | `src/routes/session.ts:47-48` |
| DO-002 | DO | SessionDO methods lack authorization checks | `src/durables/SessionDO.ts:82-209` |
| DO-003 | DO | Rate limiting methods defined but never called | `src/durables/SessionDO.ts:214-285` |
| API-001 | API | Authorization bypass - any user can access any subscription | `src/routes/subscription.ts:56-76,98-184` |
| SECRETS-001 | Secrets | Client secret hashes exposed in git history | `src/db/seed.sql:10,21,32,43` |

---

## Full Findings Table

### Critical Severity (11 findings)

| ID | Category | Description | Location |
|----|----------|-------------|----------|
| AUTH-001 | Auth | Session token, user_id, email exposed in OAuth redirect URL parameters | `src/routes/oauth/google.ts:274-287` |
| AUTH-002 | Auth | Set-Cookie header in 302 redirect response may not be processed by all browsers | `src/routes/oauth/google.ts:216-223` |
| DATA-001 | Data | Email addresses logged to console in multiple locations | `src/auth/index.ts:253,290,297,300` |
| DATA-002 | Data | OAuth access_token, refresh_token, id_token stored unencrypted | `src/db/auth.schema.ts:87-94` |
| DATA-003 | Data | Full session data including user PII cached in plaintext KV | `src/lib/server/session.ts:226-228` |
| DATA-004 | Data | hashSecret() uses SHA-256 without salt or iterations | `src/utils/crypto.ts:96-106` |
| DO-001 | Durable Objects | SessionDO ID derived from userId enables privilege escalation if SESSION_SECRET leaks | `src/routes/session.ts:47-48,151-152,192-193` |
| DO-002 | Durable Objects | SessionDO methods (validateSession, createSession, etc.) lack authorization validation | `src/durables/SessionDO.ts:82-209` |
| DO-003 | Durable Objects | checkLoginRateLimit() and recordLoginAttempt() defined but never called | `src/durables/SessionDO.ts:214-285` |
| API-001 | API | Subscription endpoints allow any authenticated user to read/modify any user's data | `src/routes/subscription.ts:56-76,98-184` |
| SECRETS-001 | Secrets | Four production client secret hashes committed to git history | `src/db/seed.sql:10,21,32,43` |

### High Severity (19 findings)

| ID | Category | Description | Location |
|----|----------|-------------|----------|
| AUTH-003 | Auth | CORS whitelist hardcoded instead of validating against client registry | `src/middleware/cors.ts:36-53` |
| AUTH-004 | Auth | code_challenge_method not required, defaults to S256 if missing | `src/routes/token.ts:182-196` |
| AUTH-005 | Auth | Auth code validation and marking used are separate DB calls - race condition | `src/routes/token.ts:158-199` |
| AUTH-006 | Auth | Magic codes marked as used but not deleted - database bloat | `src/routes/magic.ts:213` |
| AUTH-007 | Auth | Account lock status checked before verification but not before recording attempt | `src/routes/magic.ts:178-210` |
| INJ-001 | Injection | DOM XSS via innerHTML with backup codes from API responses | `src/templates/settings.ts:998,1080,1110` |
| DATA-005 | Data | Account locked status reveals email existence - enumeration attack | `src/routes/magic.ts:180-189` |
| DATA-006 | Data | Admin /users endpoint returns all user fields without filtering | `src/routes/admin.ts:77-85` |
| DATA-007 | Data | JWT access tokens contain email and name claims (visible in base64) | `src/services/jwt.ts:46-54` |
| DATA-008 | Data | Admin routes have no rate limiting - can enumerate all users/logs | `src/routes/admin.ts:49-99` |
| DATA-009 | Data | Schema has tenantId but queries don't filter by tenant | `src/db/queries.ts` |
| DO-004 | Durable Objects | Session endpoints (validate, revoke, list, delete) lack rate limiting | `src/routes/session.ts` |
| DO-005 | Durable Objects | revokeAllSessions has no confirmation - account lockout attack | `src/routes/session.ts:177-201` |
| DO-006 | Durable Objects | createSession doesn't validate parameter lengths - storage exhaustion | `src/durables/SessionDO.ts:82-108` |
| DO-007 | Durable Objects | Session cookies use SameSite=Lax instead of Strict | `src/lib/session.ts:138` |
| DO-008 | Durable Objects | Session cookie format exposes userId in plaintext | `src/lib/session.ts:68-76` |
| SECRETS-002 | Secrets | Admin emails hardcoded in source code | `src/types.ts:365`, `src/db/seed.sql:50` |
| SECRETS-003 | Secrets | OAuth error responses logged to console may contain sensitive data | `src/services/oauth.ts:64,70` |
| SECRETS-004 | Secrets | Production OAuth client configuration in source code | `src/db/seed.sql:5-46` |

### Medium Severity (21 findings)

| ID | Category | Description | Location |
|----|----------|-------------|----------|
| AUTH-008 | Auth | Manual regex-based cookie parsing could miss edge cases | `src/routes/session.ts:110-122` |
| AUTH-009 | Auth | Expired auth codes accumulate without cleanup | Database |
| AUTH-010 | Auth | Multiple Set-Cookie headers with potentially inconsistent values | `src/routes/session.ts:158-162` |
| AUTH-011 | Auth | Magic codes only 6 digits (1M possibilities) | `src/utils/crypto.ts:24-30` |
| AUTH-012 | Auth | code_challenge_method validation happens too late in OAuth flow | `src/routes/oauth/google.ts:36-93` |
| AUTH-013 | Auth | Sensitive errors logged to console | `src/services/oauth.ts:64,70,87,93` |
| AUTH-014 | Auth | Different handling for internal services bypasses standard OAuth | `src/routes/oauth/google.ts:204-223` |
| INJ-002 | Injection | CDN folder parameter not validated for path traversal | `src/routes/cdn.ts:127,153-154` |
| INJ-003 | Injection | JSON.stringify in script context could allow script breakout | `src/templates/login.ts:420-424` |
| DATA-010 | Data | IP addresses and user agents stored unencrypted | `src/db/auth.schema.ts` |
| DATA-011 | Data | Failed attempts table stores email unencrypted | Database |
| DATA-012 | Data | Audit logs accumulate indefinitely without retention policy | Database |
| DATA-013 | Data | Rate limiting keys use plaintext email | Rate limiter |
| DATA-014 | Data | Client secrets use SHA-256 instead of proper password hashing | `src/utils/crypto.ts` |
| DO-009 | Durable Objects | sessionId from URL not validated as UUID format | `src/routes/session.ts:239` |
| DO-010 | Durable Objects | Session timeout is 30 days - excessive | `src/lib/session.ts:135` |
| DO-011 | Durable Objects | Alarm handler deletes expired sessions without batching | `src/durables/SessionDO.ts:341-368` |
| API-002 | API | Better Auth routes not protected by custom rate limiters | `src/auth/index.ts:118-123` |
| API-003 | API | Minecraft proxy exposes internal URLs in error messages | `src/routes/minecraft.ts` |
| API-004 | API | Subscription endpoints have no rate limiting | `src/routes/subscription.ts` |
| SECRETS-005 | Secrets | OAuth state parameters may be logged in error scenarios | Various |

### Low Severity (13 findings)

| ID | Category | Description | Location |
|----|----------|-------------|----------|
| AUTH-015 | Auth | Different error messages for code not found vs expired vs used | `src/routes/token.ts` |
| AUTH-016 | Auth | Three session mechanisms with fallback chain adds complexity | `src/routes/session.ts` |
| AUTH-017 | Auth | Hardcoded admin emails should be in database or env vars | `src/types.ts:365` |
| AUTH-018 | Auth | No rate limiting on /verify endpoint - token enumeration risk | `src/routes/verify.ts` |
| INJ-004 | Injection | sanitizeString() function is incomplete and unused | `src/utils/validation.ts:78-81` |
| DATA-015 | Data | Auth codes in redirect URLs (mitigated by short expiry) | OAuth flow |
| DATA-016 | Data | Database schema doesn't mark sensitive columns | Schema |
| DATA-017 | Data | Session cookie security attributes not comprehensive | Session handling |
| API-005 | API | Query parameter bounds not validated on admin endpoints | `src/routes/admin.ts` |
| API-006 | API | Root endpoint exposes complete API documentation | `src/index.ts:92-175` |
| API-007 | API | OAuth state expiry hardcoded to 10 minutes | `src/routes/oauth/google.ts:75` |
| API-008 | API | Admin endpoint exposes client configuration details | `src/routes/admin.ts` |
| API-009 | API | Form data parsing doesn't validate Content-Type header | `src/routes/token.ts`, `src/routes/magic.ts` |
| DEP-001 | Dependencies | cookie@0.6.0 has LOW severity vulnerability | `frontend/package.json` |

---

## Cross-Cutting Patterns Observed

### 1. Authorization Check Gaps
Multiple endpoints verify authentication but not authorization:
- Subscription endpoints allow cross-user access
- SessionDO methods trust caller without verification
- Admin data exposure lacks field filtering

### 2. PII Handling Inconsistencies
Email addresses appear in:
- URL parameters (OAuth redirect)
- Console logs
- JWT claims
- Unencrypted database fields
- Rate limiting keys

### 3. Incomplete Rate Limiting Coverage
Rate limiting is well-implemented on core auth endpoints but missing on:
- Admin routes
- Session management routes
- Subscription routes
- Better Auth integration routes

### 4. Secrets Management Gaps
- Client secret hashes committed to git
- Admin emails hardcoded
- Production configuration in source code
- Error messages expose internal details

### 5. Session Security Inconsistencies
- SameSite=Lax instead of Strict
- User ID exposed in cookie format
- Multiple session mechanisms add complexity
- 30-day session timeout is excessive

---

## Positive Findings

The audit identified numerous well-implemented security controls:

### Authentication & Authorization
1. **PKCE Implementation** - OAuth flows properly implement code challenge/verifier with S256
2. **JWT RS256 Signing** - Strong asymmetric algorithm for token signing
3. **Token Expiry** - Reasonable defaults (1hr access, 30d refresh)
4. **Refresh Token Rotation** - New tokens issued on refresh, old revoked
5. **Email Allowlist** - Flexible access control for user registration

### Cryptographic Security
6. **Timing-Safe Comparisons** - `timingSafeEqual()` prevents timing attacks
7. **HMAC Session Cookies** - Signed with HMAC-SHA256
8. **Secure Code Generation** - Cryptographically secure random for tokens/codes

### Input Validation
9. **Zod Schema Validation** - All API endpoints validate with Zod schemas
10. **Parameterized Queries** - All SQL uses `.bind()` - no SQL injection
11. **Redirect URI Validation** - Validated against registered URIs
12. **HTML Escaping** - `escapeHtml()` properly implemented and used

### Rate Limiting & Account Protection
13. **Comprehensive Rate Limiting** - Per-email, per-IP, per-client limits on auth
14. **Account Lockout** - 5 failed attempts triggers 15-minute lockout
15. **Magic Link Security** - Proper expiry and single-use enforcement

### Infrastructure Security
16. **Security Headers** - CSP, HSTS, X-Frame-Options, X-Content-Type-Options
17. **Cookie Security Flags** - HttpOnly, Secure attributes properly set
18. **Audit Logging** - All auth events logged with IP, user agent, event type
19. **Session Isolation** - Per-user Durable Object instances

### Dependency Security
20. **Clean Backend Dependencies** - No known vulnerabilities in backend
21. **Lockfiles Committed** - Reproducible builds ensured
22. **Trusted Sources** - All packages from npmjs.com
23. **No Typosquatting** - Package names verified

---

## Recommendations

### Immediate Actions (Before Launch)

1. **Fix Authorization Bypass** (API-001)
   - Add ownership check to all subscription endpoints
   - Verify `payload.sub === userId` before data access

2. **Remove PII from URLs** (AUTH-001)
   - Stop passing session_token, user_id, email in redirect URLs
   - Use secure cookies exclusively

3. **Stop Logging Emails** (DATA-001)
   - Remove all `console.log` with email addresses
   - Hash emails in audit logs

4. **Rotate Compromised Secrets** (SECRETS-001)
   - Generate new client secrets for all production clients
   - Remove seed.sql from git history
   - Update all client applications

5. **Add Authorization to SessionDO** (DO-002)
   - Implement defense-in-depth authorization checks

### Short-Term Actions (Within 2 Weeks)

6. **Encrypt Sensitive Data at Rest** (DATA-002, DATA-003)
   - Implement field-level encryption for OAuth tokens
   - Encrypt PII in KV cache

7. **Improve Token Hashing** (DATA-004)
   - Replace SHA-256 with Argon2id or PBKDF2
   - Add salt and proper iteration count

8. **Harden Session Cookies** (DO-007, DO-008)
   - Change SameSite to Strict
   - Remove userId from cookie format

9. **Add Missing Rate Limiting** (DO-004, DATA-008, API-002, API-004)
   - Protect admin, session, and subscription endpoints

10. **Fix CORS Configuration** (AUTH-003)
    - Validate against registered client origins

### Medium-Term Actions (Within 1 Month)

11. **Fix DOM XSS** (INJ-001)
    - Replace innerHTML with safe DOM manipulation

12. **Add Path Traversal Protection** (INJ-002)
    - Validate folder parameter in CDN uploads

13. **Remove PII from JWT** (DATA-007)
    - Only include `sub` claim, fetch details from /userinfo

14. **Implement Data Retention** (DATA-012)
    - Add cleanup jobs for audit logs and expired codes

15. **Migrate Admin Management** (SECRETS-002)
    - Move admin emails to database or environment variables

---

## Files Requiring Changes (Priority Order)

### Priority 1 - Critical
- `/home/user/GroveAuth/src/routes/subscription.ts`
- `/home/user/GroveAuth/src/routes/oauth/google.ts`
- `/home/user/GroveAuth/src/auth/index.ts`
- `/home/user/GroveAuth/src/durables/SessionDO.ts`
- `/home/user/GroveAuth/src/db/seed.sql`
- `/home/user/GroveAuth/src/utils/crypto.ts`
- `/home/user/GroveAuth/src/lib/server/session.ts`

### Priority 2 - High
- `/home/user/GroveAuth/src/middleware/cors.ts`
- `/home/user/GroveAuth/src/routes/token.ts`
- `/home/user/GroveAuth/src/routes/magic.ts`
- `/home/user/GroveAuth/src/routes/session.ts`
- `/home/user/GroveAuth/src/routes/admin.ts`
- `/home/user/GroveAuth/src/services/jwt.ts`
- `/home/user/GroveAuth/src/services/oauth.ts`
- `/home/user/GroveAuth/src/lib/session.ts`
- `/home/user/GroveAuth/src/types.ts`
- `/home/user/GroveAuth/src/templates/settings.ts`

### Priority 3 - Medium
- `/home/user/GroveAuth/src/routes/cdn.ts`
- `/home/user/GroveAuth/src/templates/login.ts`
- `/home/user/GroveAuth/src/routes/minecraft.ts`
- `/home/user/GroveAuth/src/utils/validation.ts`
- `/home/user/GroveAuth/src/db/auth.schema.ts`
- `/home/user/GroveAuth/src/db/queries.ts`

---

## Conclusion

The Grove Authentication Service has a solid security foundation with proper OAuth 2.0 implementation, strong cryptographic choices, and comprehensive input validation. However, the identified critical and high severity findings present significant risks that must be addressed before production deployment.

**Key Actions Required:**
1. Fix authorization bypass in subscription endpoints
2. Remove PII from URLs and logs
3. Rotate compromised client secrets
4. Add missing rate limiting
5. Encrypt sensitive data at rest

The remediation plan in `REMEDIATION-PLAN.md` provides detailed, actionable tasks for each finding.

---

*Report generated by Security Audit Agent - Phase 1 Consolidation*
