# Security Audit: Secrets & Configuration

## Executive Summary

**Severity Breakdown:**
- Critical: 1
- High: 3
- Medium: 1
- Low: 0
- **Total Issues:** 5
- **Positive Findings:** 8

---

## Critical Findings

### 1. Client Secret Hashes Exposed in Git History

**Location:** `/home/user/GroveAuth/src/db/seed.sql` (lines 10, 21, 32, 43)

**Issue:** Four client secret hashes are hardcoded in seed.sql and committed to git:
- GroveEngine: `UUmHuEAZ07nnhhU91L1zWBdTPsZXR68JQgPW5N5aJZE`
- AutumnsGrove: `CfHJBZwJmFy0eXNx9vRUZAvXj673ePuuIGhX3IyJEik=`
- Amber: `lO8UBoFJKFkyTKvyoBp-LAyAzrC5j2kg4lQmkxKq5Vc`
- Plant: `sSqlPr1D6qdmpz2WkCz0tDmw8-60SaE0zDCuWvAdpFI`

**Risk Level:** CRITICAL

**Details:** While these are hashes (not plaintext secrets), they are verification values used to authenticate client applications in production.

**Git History:** Commits `8b2fcfb`, `5cd8fb6`, `abb62f0`, `fffa2b2` contain these hashes.

**Recommendation:**
1. Rotate all client secrets for these production clients
2. Remove seed.sql from git history using `git filter-branch` or BFG Repo-Cleaner
3. Use environment variables for production client secrets
4. Move to secrets management approach

---

## High Severity Findings

### 2. Admin Email Address Hardcoded in Multiple Locations

**Location 1:** `/home/user/GroveAuth/src/db/seed.sql` (line 50)
- Email: `autumnbrown23@pm.me`

**Location 2:** `/home/user/GroveAuth/src/types.ts` (line 365)
```typescript
export const ADMIN_EMAILS = ['autumn@grove.place', 'autumnbrown23@pm.me'];
```

**Risk Level:** HIGH

**Impact:** Email addresses publicly visible could enable:
- Targeted phishing attacks
- Password reset attacks
- Social engineering attacks
- Account enumeration

**Recommendation:**
- Move `ADMIN_EMAILS` to environment configuration
- Remove from git history

---

### 3. Potential OAuth Error Information Disclosure

**Location:** `/home/user/GroveAuth/src/services/oauth.ts` (lines 64, 70)

**Issue:**
```typescript
console.error('Google token exchange failed:', await response.text());
console.error('Google token exchange error:', error);
```

**Risk Level:** HIGH

**Details:** Error responses from Google OAuth could contain sensitive information.

**Recommendation:**
- Log only generic error messages in production
- Use structured logging with sanitization
- Example: `console.error('OAuth exchange failed with status:', response.status);`

---

### 4. Production Client Configuration in Source Code

**Location:** `/home/user/GroveAuth/src/db/seed.sql` (lines 5-46)

**Issue:** Four production OAuth clients defined with credentials:
- GroveEngine, AutumnsGrove, Amber, Plant

**Risk Level:** HIGH

**Details:** Client IDs, redirect URIs, and allowed origins are exposed.

**Recommendation:**
- Use separate seed files for production vs development
- Move to environment-based configuration
- Use database migrations for sensitive data

---

## Medium Severity Findings

### 5. OAuth State Parameter Logging

**Issue:** OAuth state parameters may be logged in some error scenarios.

**Recommendation:** Ensure state parameters are never logged.

---

## Positive Findings (Security Well Implemented)

### No Plaintext Secrets in Source Code
- JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, GOOGLE_CLIENT_SECRET, RESEND_API_KEY properly accessed from Cloudflare environment variables

### Proper .gitignore Configuration
- `*.pem` files excluded
- `.env*` files excluded
- `secrets.json` excluded

### Secure Token Storage
- Tokens stored as hashes in database
- Refresh tokens properly rotated
- No plaintext tokens in logs

### Client Secret Hashing
- Client secrets hashed using SHA-256 before storage
- Properly verified during authentication

### No Test Secrets
- No test files with hardcoded credentials found
- No mock secrets in code

### Secure Configuration Files
- wrangler.toml has no secrets
- Properly marked for `wrangler secret put`

### Documentation Best Practices
- README and specs use placeholder values
- No actual secrets in documentation
- Proper setup instructions using wrangler

### Middleware Security
- Rate limiting implemented
- CSRF protection via state parameter
- PKCE validation in place

---

## Immediate Actions Required

### Priority 1 (Today)
1. Rotate all four production client secrets
2. Update client secret hashes in database
3. Notify client applications to update their secrets

### Priority 2 (This Week)
1. Remove seed.sql client hashes from git history
2. Move ADMIN_EMAILS to environment configuration
3. Update error logging in oauth.ts
4. Create separate development seed file

### Priority 3 (This Sprint)
1. Implement secrets rotation procedure
2. Set up secret scanning in git pre-commit hooks
3. Create separate environment configurations
4. Add secret management documentation
