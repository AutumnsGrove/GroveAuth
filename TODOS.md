# TODOs for GroveAuth

## Pre-Deployment Setup (Requires Local Machine)
- [ ] Generate RSA keypair for JWT signing (see LATER_COMMANDS.md)
- [ ] Create Google OAuth credentials at console.cloud.google.com
- [ ] Create GitHub OAuth app at github.com/settings/developers
- [ ] Set up Resend account and verify grove.place domain
- [ ] Create D1 database via `wrangler d1 create groveauth`
- [ ] Update `wrangler.toml` with actual database_id
- [ ] Set all secrets via `wrangler secret put`
- [ ] Configure DNS for auth.grove.place

## Deployment Tasks

### Backend (Worker API)
- [ ] Run database migrations (`pnpm db:migrate`)
- [ ] Run seed data (`pnpm db:seed`)
- [ ] Deploy to Cloudflare (`pnpm deploy`)
- [ ] Test all auth flows end-to-end
- [ ] Verify rate limiting works
- [ ] Check security headers

### Frontend (SvelteKit)
- [ ] Install frontend dependencies (`cd frontend && pnpm install`)
- [ ] Build frontend (`cd frontend && pnpm build`)
- [ ] Deploy to Cloudflare Pages (`cd frontend && wrangler pages deploy .svelte-kit/cloudflare`)
- [ ] Configure custom domain for frontend (if different from API)

## Integration Tasks
- [ ] Add GroveAuth client helpers to @autumnsgrove/groveengine
- [ ] Update GroveEngine to use GroveAuth for admin authentication
- [ ] Test full OAuth flow from GroveEngine → GroveAuth → back

## Future Enhancements (Post v1)
- [ ] WebAuthn/Passkey support
- [ ] Session management UI (view/revoke sessions)
- [ ] Admin dashboard for user management
- [ ] Multi-factor authentication
- [ ] IP-based access restrictions

## Code Quality
- [ ] Add comprehensive unit tests
- [ ] Add integration tests for OAuth flows
- [ ] Security audit and penetration testing

---

*Last updated: 2025-12-08*
