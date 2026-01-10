# Project Instructions - Heartwood (GroveAuth)

> **Note**: This is the main orchestrator file. For detailed guides, see `AgentUsage/README.md`

---

## Naming

| | |
|---|---|
| **Public Name** | Heartwood |
| **Internal Codename** | GroveAuth |
| **Domain** | heartwood.grove.place |
| **Description** | The heartwood is the dense, authentic core of a tree — just as Heartwood is the secure authentication core of the Grove ecosystem. |

> "All our sites use Heartwood for login"

---

## Project Purpose

Heartwood (internally: GroveAuth) is a centralized authentication service for all AutumnsGrove properties. It handles OAuth (Google) and Magic Link (email) authentication, issuing JWT tokens that client sites can verify. Runs on Cloudflare Workers with D1 database.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Cloudflare Workers
- **Framework**: Hono.js
- **Database**: Cloudflare D1 (SQLite)
- **Key Libraries**: jose (JWT), zod (validation)
- **Package Manager**: pnpm

## Architecture Notes

- **OAuth 2.0 Authorization Code Flow with PKCE** for Google
- **Magic Code** (6-digit email codes via Resend) as fallback
- **Admin-only access** - allowlist-based, no public registration
- **JWT tokens** signed with RS256 (1hr access, 30d refresh)
- **Rate limiting** on all sensitive endpoints
- **Audit logging** for all auth events

### Key Files
- `src/index.ts` - Main Hono app entry point
- `src/routes/` - Route handlers for each endpoint
- `src/services/` - Business logic (JWT, OAuth, email)
- `src/middleware/` - CORS, rate limiting, security headers
- `src/db/schema.sql` - Database schema
- `templates/` - HTML templates for login page

---

## Essential Instructions (Always Follow)

### Core Behavior
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary for achieving your goal
- ALWAYS prefer editing existing files to creating new ones
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested

### Naming Conventions
- **Directories**: Use CamelCase (e.g., `VideoProcessor`, `AudioTools`, `DataAnalysis`)
- **Date-based paths**: Use skewer-case with YYYY-MM-DD (e.g., `logs-2025-01-15`, `backup-2025-12-31`)
- **No spaces or underscores** in directory names (except date-based paths)

### TODO Management
- **Always check `TODOS.md` first** when starting a task or session
- **Update immediately** when tasks are completed, added, or changed
- Keep the list current and manageable

### Git Workflow Essentials

**After completing major changes, you MUST commit your work.**

**Conventional Commits Format:**
```bash
<type>: <brief description>

<optional body>

Co-Authored-By: Claude <agent@localhost>
```

**Common Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

**Examples:**
```bash
feat: Add Google OAuth flow
fix: Correct rate limiting logic
docs: Update API documentation
```

**For complete details:** See `AgentUsage/git_guide.md`

---

## When to Read Specific Guides

**Read the full guide in `AgentUsage/` when you encounter these situations:**

### Secrets & API Keys
- **When managing API keys or secrets** → Read `AgentUsage/secrets_management.md`
- **Before implementing secrets loading** → Read `AgentUsage/secrets_management.md`

### Cloudflare Development
- **When deploying to Cloudflare** → Read `AgentUsage/cloudflare_guide.md`
- **Before using Cloudflare Workers, KV, R2, or D1** → Read `AgentUsage/cloudflare_guide.md`

### Version Control
- **Before making a git commit** → Read `AgentUsage/git_guide.md`
- **For conventional commits reference** → Read `AgentUsage/git_guide.md`

### Testing
- **Before writing TypeScript tests** → Read `AgentUsage/testing_javascript.md`

---

## Project-Specific Notes

### Secrets Required (set via `wrangler secret put`)
- `JWT_PRIVATE_KEY` - RSA private key (PEM format)
- `JWT_PUBLIC_KEY` - RSA public key (PEM format)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `RESEND_API_KEY` - Resend API key for email

### Database Setup
```bash
# Create D1 database
wrangler d1 create groveauth

# Run migrations
pnpm db:migrate

# Seed initial data
pnpm db:seed
```

### RSA Key Generation
Generate keys locally (do NOT commit to git):
```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# Set as secrets
wrangler secret put JWT_PRIVATE_KEY < private.pem
wrangler secret put JWT_PUBLIC_KEY < public.pem

# Delete local files
rm private.pem public.pem
```

### Initial Clients
- **groveengine** - GroveEngine internal site (*.grove.place)
- **autumnsgrove** - AutumnsGrove main site

### Initial Allowed Admin
- `autumnbrown23@pm.me`

---

## Quick Reference

### Security Basics
- Store API keys as Cloudflare secrets (NEVER in code)
- Use PKCE for all OAuth flows
- Rate limit all authentication endpoints
- Log all auth events for audit trail

### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /login` | Login page with provider selection |
| `GET /oauth/google` | Initiate Google OAuth |
| `POST /magic/send` | Send magic code email |
| `POST /magic/verify` | Verify magic code |
| `POST /token` | Exchange code for tokens |
| `POST /token/refresh` | Refresh access token |
| `GET /verify` | Verify access token |
| `GET /userinfo` | Get current user info |
| `GET /health` | Health check |

---

## Communication Style
- Be concise but thorough
- Explain reasoning for significant decisions
- Ask for clarification when requirements are ambiguous
- Proactively suggest improvements when appropriate

---

*Last updated: 2025-12-08*
*Model: Claude Opus 4*
