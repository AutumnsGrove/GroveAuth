# Security Audit: Dependencies & Supply Chain

## Executive Summary

**Overall Status:** GOOD with one LOW severity issue requiring attention

**Audit Scope:**
- Backend: `/home/user/GroveAuth/package.json` + `pnpm-lock.yaml`
- Frontend: `/home/user/GroveAuth/frontend/package.json` + `frontend/pnpm-lock.yaml`
- Package Manager: pnpm v10.23.0

**Vulnerability Summary:**
- Critical: 0
- High: 0
- Medium: 0
- Low: 1
- No Known Vulnerabilities: Backend ✓

---

## Detailed Findings

### 1. VULNERABILITY: Cookie Package (LOW Severity)

**Location:** Frontend dependency chain
**Package:** `cookie@0.6.0`
**Path:** `@sveltejs/kit@2.49.1` → `cookie@0.6.0`
**CVE/Advisory:** GHSA-pxg6-pf52-xh8x
**Vulnerability Type:** Out-of-bounds character handling

**Description:** Cookie package version 0.6.0 accepts cookie name, path, and domain with out-of-bounds characters.

**Details:**
- Vulnerable versions: `<0.7.0`
- Patched versions: `>=0.7.0`
- Latest version available: `1.1.1`
- Current version: `0.6.0`

**Risk Assessment:** LOW - Defensive issue related to cookie parsing input validation.

**Recommended Action:**
1. Update `@sveltejs/kit` to the latest version (2.49.4 or higher)
2. Verify new version upgrades transitive `cookie` dependency
3. Re-run `pnpm audit` to confirm resolution

---

## Backend Dependencies - CLEAN

**Status:** No known vulnerabilities detected

**Direct Dependencies:**
```
@better-auth/passkey: ^1.4.10  ✓ Current
better-auth: ^1.4.10           ✓ Current
better-auth-cloudflare: ^0.2.9 ✓ Current
drizzle-orm: ^0.45.1           ✓ Current
hono: ^4.10.7                  ✓ Current (latest: 4.11.3)
jose: ^6.1.3                   ✓ Current
zod: ^4.1.13                   ✓ Current (latest: 4.3.5)
```

**DevDependencies:**
```
@cloudflare/workers-types: ^4.20251205.0  ✓ Current
@types/node: ^24.10.1                     ✓ Current
typescript: ^5.9.3                        ✓ Current
vitest: ^4.0.15                           ✓ Current (latest: 4.0.16)
wrangler: ^4.53.0                         ✓ Current (latest: 4.58.0)
```

---

## Frontend Dependencies

**Status:** 1 LOW severity vulnerability found

**Key Direct Dependencies:**
```
@better-auth/passkey: ^1.4.10      ✓ Used actively
better-auth: ^1.4.10               ✓ Used actively
lucide-svelte: ^0.513.0            ✓ Used actively
@sveltejs/kit: ^2.0.0              ⚠ Contains vulnerable cookie
@sveltejs/adapter-cloudflare: ^7.0.0
svelte: ^5.0.0
```

---

## Lockfile Integrity

**✓ Both lockfiles are committed to git:**
- `/home/user/GroveAuth/pnpm-lock.yaml` - Committed
- `/home/user/GroveAuth/frontend/pnpm-lock.yaml` - Committed

**Assessment:** Excellent. Lockfiles properly version controlled, ensuring reproducible builds.

---

## Dependency Source Verification

**All packages verified from:**
- npmjs.com registry (primary)
- No suspicious registries detected
- No typosquatting risks identified
- All packages have consistent naming

**Example package origins:**
- `jose` - jshttp organization (JWT library)
- `hono` - honojs (Web framework)
- `zod` - Zod maintainers (Validation library)
- `better-auth` - Better Auth team (Auth framework)

---

## Package Manager Lock

**Status:** ✓ Properly configured

```json
"packageManager": "pnpm@10.23.0"
```

Using latest pnpm with exact pinning.

---

## Unused Dependencies Check

**Backend:** No unused dependencies detected
**Frontend:** No unused dependencies detected

---

## Positive Findings

✓ **Lockfiles Committed:** Both pnpm-lock.yaml files are version controlled
✓ **No Backend CVEs:** Backend dependencies free of known vulnerabilities
✓ **Trusted Sources:** All packages from npmjs.com
✓ **Version Pinning:** pnpm version explicitly specified
✓ **Well-Maintained Dependencies:** Core packages actively maintained
✓ **No Typosquatting Risks:** Package names standard and unambiguous
✓ **Semantic Versioning:** Using caret (^) versions for flexibility with safety
✓ **No Duplicate Versions:** Only one version of each package

---

## Recommended Actions

**Priority 1 (Address LOW vulnerability):**
```bash
cd frontend
pnpm update @sveltejs/kit
pnpm audit
```

**Priority 2 (Optional updates - patch level):**
- `vitest`: ^4.0.15 → ^4.0.16
- `@cloudflare/workers-types`: ^4.20251205.0 → latest
- `wrangler`: ^4.53.0 → ^4.58.0

**Priority 3 (Optional updates - minor level):**
- `hono`: ^4.10.7 → ^4.11.3
- `zod`: ^4.1.13 → ^4.3.5
- `@types/node`: ^24.10.1 → latest

**Ongoing Best Practices:**
1. Run `pnpm audit` regularly (weekly)
2. Monitor npm advisory database
3. Keep pnpm updated to latest version
4. Review `pnpm outdated` monthly
5. Maintain current lockfiles in version control

---

## Summary

The Grove authentication service has a **strong security posture** regarding dependencies. The backend has no known vulnerabilities, and both frontend and backend use properly committed lockfiles. The single LOW severity vulnerability in the `cookie` package should be addressed by updating `@sveltejs/kit`, but it poses minimal risk.

**Overall Risk Level: LOW**
