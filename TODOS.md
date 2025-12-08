# TODOs for GroveAuth

## Completed (2025-12-08)
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

## In Progress
- [ ] Fix admin.grove.place to show dashboard after login (session check not recognizing access_token cookie)
- [ ] Remove debug error messages from grove.place callback

## Next Up
- [ ] Add GitHub OAuth redirect URI for auth-api.grove.place
- [ ] Test login.grove.place redirect behavior
- [ ] Test full OAuth flow end-to-end for all providers

## Integration Tasks
- [x] Add GroveAuth client helpers to @autumnsgrove/groveengine
- [x] Add sign-in to grove.place landing
- [ ] Update GroveEngine domains to use GroveAuth for admin authentication

## Future Enhancements (Post v1)
- [ ] WebAuthn/Passkey support
- [ ] Session management UI (view/revoke sessions)
- [ ] Multi-factor authentication
- [ ] IP-based access restrictions

## Code Quality
- [ ] Add comprehensive unit tests
- [ ] Add integration tests for OAuth flows
- [ ] Security audit and penetration testing

---

*Last updated: 2025-12-08*
