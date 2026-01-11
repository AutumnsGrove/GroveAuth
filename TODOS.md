# TODOs for Heartwood (GroveAuth)

## Completed (2025-12-12)
- [x] Rebrand to "Heartwood" public name (internal codename remains GroveAuth)
- [x] Update all docs, frontend, and templates with Heartwood branding
- [x] Add heartwood.grove.place custom domain to groveauth-frontend Pages project
- [x] Deploy frontend with Heartwood branding

## Completed (2025-12-10)
- [x] Generate RSA keypair for JWT signing
- [x] Create Google OAuth credentials
- [x] Create GitHub OAuth app
- [x] Set up Resend account
- [x] Create D1 database via `wrangler d1 create groveauth`
- [x] Update `wrangler.toml` with actual database_id
- [x] Set all secrets via `wrangler secret put`
- [x] Configure DNS for auth.grove.place (frontend)
- [x] Configure DNS for auth-api.grove.place (backend API)
- [x] Deploy backend Worker API
- [x] Deploy frontend to Cloudflare Pages
- [x] Set up multi-subdomain support (auth/admin/login.grove.place)
- [x] Add user subscription tiers & post limits
- [x] Add admin dashboard API endpoints
- [x] Add sign-in flow to grove.place landing page
- [x] Fix API URL references (auth.grove.place → auth-api.grove.place)
- [x] Fix client secret hash encoding (base64 → base64url)
- [x] Update Google OAuth redirect URI for auth-api.grove.place
- [x] Cross-subdomain cookies working (domain=.grove.place)
- [x] Full OAuth flow: grove.place → auth.grove.place → Google → back with tokens
- [x] Fix admin.grove.place OAuth flow (direct OAuth + token exchange + session handling)
- [x] Add dark/light mode toggle to admin dashboard
- [x] Fix timezone display in Recent Activity (now shows local time)
- [x] Replace Quicksand font with Lexend from GroveEngine
- [x] Add DarkReader lock meta tag to disable DarkReader extension
- [x] Fix subdomain detection on Cloudflare Pages (use x-forwarded-host header)

## Completed (2026-01-07)
- [x] **Better Auth Migration** — Major performance improvement!
  - [x] Integrated Better Auth with Cloudflare D1/KV
  - [x] Added Google, GitHub OAuth via Better Auth
  - [x] Added magic link plugin with Resend
  - [x] Added passkey (WebAuthn) plugin for passwordless auth
  - [x] Created Drizzle schema for Better Auth tables (ba_user, ba_session, ba_account, ba_verification, ba_passkey)
  - [x] Migrated existing users to Better Auth tables
  - [x] Added KV namespace for session caching (sub-100ms validation!)
  - [x] Cross-subdomain cookies for .grove.place SSO
  - [x] Legacy endpoints preserved for backwards compatibility
  - **Result:** Auth flow reduced from ~15s to ~1.5-2s 🎉

## In Progress
- [ ] Fix heartwood.grove.place routing (domain added to Pages, but traffic still going through wildcard router)
  - May need to remove domain from router worker and re-add to Pages project

## Next Up
- [ ] Fix admin.grove.place OAuth sign-in ("Service route not configured" error)
  - The OAuth URL is using client_id='groveengine' with redirect_uri='https://admin.grove.place/callback'
  - Need to verify this client/redirect_uri is registered in the backend
- [ ] Add GitHub OAuth redirect URI for auth-api.grove.place
- [ ] Test login.grove.place redirect behavior
- [ ] Test full OAuth flow end-to-end for all providers
- [ ] Remove debug error messages from grove.place callback
- [ ] Migrate Grove clients to use new `/api/auth/*` endpoints (optional, legacy still works)

## Admin Dashboard Fixes
- [ ] Dashboard not showing all registered clients (missing GroveScout, GroveMusic, etc.)
- [ ] Verify all internal domains are registered in clients table

## Integration Tasks
- [x] Add GroveAuth client helpers to @autumnsgrove/groveengine
- [x] Add sign-in to grove.place landing
- [ ] Update GroveEngine domains to use GroveAuth for admin authentication

## Future Enhancements (Post v1)
- [x] WebAuthn/Passkey support — Now available via Better Auth!
- [ ] Session management UI (view/revoke sessions)
- [x] Multi-factor authentication (2FA) — Optional TOTP for all users
- [ ] IP-based access restrictions

## Auth Provider Expansion (Deferred)
- [ ] **Apple OAuth** — Requires paid Apple Developer Account ($99/year)
  - Services ID, JWT-based client secret (expires every 6 months)
  - Add to socialProviders once account is set up
  - Target: ~1-2 months out
- [ ] **Required 2FA for Evergreen+ tiers** — Post-launch enhancement
  - Enforce 2FA for premium subscription tiers
  - Admin override capability for lockouts
  - Target: After public launch

## Code Quality
- [ ] Add comprehensive unit tests
- [ ] Add integration tests for OAuth flows
- [x] Security audit and penetration testing — **Completed 2026-01-11** (see `docs/security-audit/`)

## Security Audit Follow-up (2026-01-11)

### Critical — Requires Manual Action
- [ ] **SECRETS-001**: Rotate all client secrets (hashes are in git history)
  - Generate new secrets for: grove-engine, autumns-grove, amber, plant
  - Update database directly, notify client app owners
  - Consider using BFG Repo-Cleaner to remove from git history
- [ ] **DATA-002**: Encrypt OAuth provider tokens at rest
  - Create `/src/utils/encryption.ts` with AES-GCM encryption
  - Add `FIELD_ENCRYPTION_KEY` secret to wrangler
  - Update Better Auth config to encrypt access_token, refresh_token, id_token
- [ ] **DATA-003**: Encrypt sensitive data in KV session cache
  - Either cache only non-PII metadata, or encrypt full session data
  - Update session retrieval to decrypt
- [ ] **DATA-004**: Replace SHA-256 token hashing with PBKDF2
  - Implement PBKDF2 with 100k iterations in `/src/utils/crypto.ts`
  - Add migration plan for existing hashed secrets
- [ ] **DO-002**: Add defense-in-depth authorization to SessionDO
  - Add caller validation to SessionDO fetch handler
  - Pass caller session header from session routes

### High Priority — Should Complete Soon
- [ ] **AUTH-008**: Improve cookie parsing (use Hono's built-in parser)
- [ ] **AUTH-009**: Add cleanup job for expired auth codes
- [ ] **AUTH-011**: Consider increasing magic codes from 6 to 8 digits
- [ ] **API-002**: Add rate limiting to Better Auth `/api/auth/*` routes
- [ ] **API-004**: Add rate limiting to subscription endpoints
- [ ] **DO-009**: Validate sessionId format as UUID before use
- [ ] **DO-011**: Implement batched session cleanup in alarm handler
- [ ] **SECRETS-002**: Move admin emails from source code to environment variable

### Medium Priority — Address Post-Launch
- [ ] **DATA-010**: Hash IP addresses before storing in audit logs
- [ ] **DATA-011**: Hash emails in failed_attempts table
- [ ] **DATA-012**: Implement audit log retention policy (90 days)
- [ ] **DATA-013**: Hash emails in rate limit keys
- [ ] **AUTH-012**: Validate code_challenge_method earlier in OAuth flow
- [ ] **AUTH-013**: Sanitize sensitive info from OAuth error logs
- [ ] **AUTH-014**: Review internal service OAuth handling consistency

### Low Priority — Address When Convenient
- [ ] **AUTH-015**: Use generic error messages for all auth code failures
- [ ] **AUTH-016**: Document session mechanism migration path (SessionDO/JWT/D1)
- [ ] **AUTH-018**: Add rate limiting to /verify endpoint
- [ ] **API-009**: Add Content-Type validation to form endpoints
- [ ] **DATA-016**: Add comments to schema marking sensitive fields

> Full details in `docs/security-audit/REMEDIATION-PLAN.md` and `docs/security-audit/MEDIUM-LOW-FIXES-PLAN.md`

---

*Last updated: 2026-01-11*
