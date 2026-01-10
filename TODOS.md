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

## Completed (2026-01-10)
- [x] **Required 2FA for Evergreen+ tiers** — Premium tier security enhancement
  - [x] Added `two_factor_exempt` and `two_factor_required_bypass_until` columns to user_subscriptions
  - [x] Implemented tier-based 2FA requirement (evergreen, canopy, platform tiers)
  - [x] Added 72-hour bypass when upgrading to a tier that requires 2FA
  - [x] Admin endpoints for exemption management (`/admin/users/:userId/2fa-exempt`)
  - [x] Admin endpoints for temporary bypass (`/admin/users/:userId/2fa-bypass`)
  - [x] User-facing 2FA compliance check endpoint (`/subscription/2fa-required`)
  - [x] Settings page shows 2FA requirement status with warnings
  - [x] Disable button blocked when 2FA is required for user's tier

## Code Quality
- [ ] Add comprehensive unit tests
- [ ] Add integration tests for OAuth flows
- [ ] Security audit and penetration testing

---

*Last updated: 2026-01-10*
