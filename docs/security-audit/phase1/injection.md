# Security Audit: Injection Vectors

## Executive Summary

**Total Issues Found: 4**
- Critical: 0
- High: 1
- Medium: 2
- Low: 1

---

## Detailed Findings

### FINDING 1: DOM-Based XSS via innerHTML in Settings Template

**Severity:** HIGH
**File:** `/home/user/GroveAuth/src/templates/settings.ts`
**Lines:** 998, 1080, 1110

**Issue:** Backup codes from API responses are inserted directly into the DOM via `innerHTML` without HTML escaping:

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

**Risk Assessment:**
- If an attacker compromises the backend or performs MITM, they can inject arbitrary HTML/JavaScript
- The pattern of using `innerHTML` with concatenated strings is inherently dangerous

**Recommended Fix:**
```javascript
backupCodesList.textContent = '';
data.backupCodes.forEach(code => {
  const div = document.createElement('div');
  div.style.margin = '4px 0';
  div.textContent = code.used ? code.code + ' (used)' : code.code;
  backupCodesList.appendChild(div);
});
```

---

### FINDING 2: Path Traversal Risk in CDN Upload Folder Parameter

**Severity:** MEDIUM
**File:** `/home/user/GroveAuth/src/routes/cdn.ts`
**Lines:** 127, 153-154

**Issue:** The `folder` parameter from user input is not validated for path traversal sequences:

```typescript
// Line 127 - Gets folder from form data without validation
const folder = (formData.get('folder') as string) || '/';

// Lines 153-154 - Constructs path with minimal sanitization
const normalizedFolder = folder.startsWith('/') ? folder.substring(1) : folder;
const key = normalizedFolder ? `${normalizedFolder}/${sanitizedFilename}` : sanitizedFilename;
```

An attacker could submit `folder: "../../sensitive/path"` to write files outside the intended directory.

**Risk Assessment:** Medium - Cloudflare R2 may have its own path handling, but the code should not rely on that.

**Recommended Fix:**
```typescript
function validateFolder(folder: string): boolean {
  if (!folder || folder.startsWith('/') ||
      folder.includes('..') || folder.includes('\\') ||
      folder.includes('\0')) {
    return false;
  }
  return /^[a-zA-Z0-9._\/-]+$/.test(folder);
}
```

---

### FINDING 3: Potential JSON Injection in Login Template Script Context

**Severity:** MEDIUM
**File:** `/home/user/GroveAuth/src/templates/login.ts`
**Lines:** 420-424

**Issue:** Parameters are serialized directly into a JavaScript literal:

```typescript
const params = ${JSON.stringify({
  client_id: params.client_id,
  redirect_uri: params.redirect_uri,
  state: params.state,
})};
```

While `JSON.stringify()` provides some protection, special characters like `</script>` could break out of the context.

**Risk Assessment:** Medium - Zod validation should catch this, but the pattern is inherently risky.

**Recommended Fix:**
```typescript
const paramsStr = JSON.stringify({
  client_id: params.client_id,
  redirect_uri: params.redirect_uri,
  state: params.state,
}).replace(/</g, '\\x3c').replace(/>/g, '\\x3e');
```

---

### FINDING 4: Unused but Incomplete HTML Sanitization Function

**Severity:** LOW
**File:** `/home/user/GroveAuth/src/utils/validation.ts`
**Lines:** 78-81

**Issue:** The `sanitizeString()` function is insufficient for HTML escaping:

```typescript
export function sanitizeString(input: string): string {
  return input.replace(/[<>]/g, '').trim();
}
```

This function only removes `<` and `>` but allows event handlers like `onclick="alert()"`.

**Risk Assessment:** Low - Function is not used, so no immediate impact.

**Recommended Fix:** Either remove the unused function or replace with proper implementation.

---

## Positive Findings (Security Strengths)

### SQL Injection - No Issues Found

All database queries in `/src/db/queries.ts` properly use parameterized queries with the `.bind()` method:

```typescript
// Correct - Parameterized
db.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase())

// Correct - Dynamic query building with parameters
if (eventType) {
  query += ' WHERE event_type = ?';
  params.push(eventType);
}
db.prepare(query).bind(...params)
```

### Redirect URL Validation - Properly Implemented

`validateClientRedirectUri()` validates against a whitelist of registered URIs.

### Template XSS Protections - Generally Good

- `escapeHtml()` function properly escapes all HTML entities
- Used consistently for error messages
- User data (name, email) properly escaped

### Input Validation - Strong Use of Zod

- All API endpoints validate request bodies with Zod schemas
- Email format validation
- URL validation for redirect URIs

### CORS Security

- Dynamic CORS validation exists
- Origins validated against registered client allowlist

### Rate Limiting & Account Lockout

- Comprehensive rate limiting on auth endpoints
- Failed attempt tracking with 15-minute lockout

### Audit Logging

- All authentication events logged with IP, user agent, and details

---

## Recommendations Summary

**Priority 1 (Fix Soon):**
1. Replace `innerHTML` with safer DOM manipulation in settings.ts (HIGH severity)
2. Add path traversal validation in CDN folder parameter (MEDIUM severity)

**Priority 2 (Fix When Refactoring):**
3. Add explicit HTML escaping for script context in templates (MEDIUM severity)
4. Remove or fix the incomplete `sanitizeString()` function (LOW severity)

**Overall Security Posture:** GOOD

The codebase demonstrates strong security practices with proper parameterized queries, input validation, and audit logging. The identified issues are relatively minor and concentrated in frontend template handling.
