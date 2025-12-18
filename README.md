# Heartwood

> Centralized authentication service for AutumnsGrove properties

**Public Name**: Heartwood
**Internal Codename**: GroveAuth
**Domain**: `heartwood.grove.place`

*The heartwood is the dense, authentic core of a tree — just as Heartwood is the secure core of the Grove ecosystem.*

---

## Overview

Heartwood is a Cloudflare Worker-based authentication service that handles all authentication for AutumnsGrove sites. Instead of each site implementing its own auth logic, all sites redirect to Heartwood for login and receive verified session tokens back.

### Features

- **Multiple Auth Providers**: Google OAuth, GitHub OAuth, Magic Code (email)
- **Secure Token Management**: JWT access tokens (1hr) + refresh tokens (30d)
- **PKCE Support**: Proof Key for Code Exchange for enhanced security
- **Rate Limiting**: Protection against brute force attacks
- **Audit Logging**: Track all authentication events
- **Admin-Only Access**: Allowlist-based, no public registration

---

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Framework**: Hono.js
- **Language**: TypeScript
- **JWT**: jose library with RS256 signing

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Cloudflare account with Workers enabled
- Wrangler CLI (`pnpm add -g wrangler`)

### Installation

```bash
# Clone the repository
git clone https://github.com/AutumnsGrove/GroveAuth.git
cd GroveAuth  # Internal codename used for repository

# Install dependencies
pnpm install

# Run type checks
pnpm typecheck
```

### Configuration

1. **Create D1 Database**:
   ```bash
   wrangler d1 create groveauth
   ```

2. **Update `wrangler.toml`** with your database ID

3. **Set Secrets** (see [LATER_COMMANDS.md](LATER_COMMANDS.md) for full list):
   ```bash
   wrangler secret put JWT_PRIVATE_KEY
   wrangler secret put GOOGLE_CLIENT_ID
   # ... etc
   ```

4. **Run Migrations**:
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

### Deployment

```bash
pnpm deploy
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/login` | Login page with provider selection |
| GET | `/oauth/google` | Initiate Google OAuth |
| GET | `/oauth/google/callback` | Google OAuth callback |
| GET | `/oauth/github` | Initiate GitHub OAuth |
| GET | `/oauth/github/callback` | GitHub OAuth callback |
| POST | `/magic/send` | Send magic code email |
| POST | `/magic/verify` | Verify magic code |
| POST | `/token` | Exchange auth code for tokens |
| POST | `/token/refresh` | Refresh access token |
| POST | `/token/revoke` | Revoke refresh token |
| GET | `/verify` | Verify access token |
| GET | `/userinfo` | Get current user info |
| POST | `/logout` | Logout and revoke tokens |
| GET | `/health` | Health check |

---

## Client Integration

Sites authenticate with Heartwood using the OAuth 2.0 Authorization Code flow:

```typescript
// 1. Redirect user to Heartwood
const params = new URLSearchParams({
  client_id: 'your-client-id',
  redirect_uri: 'https://yoursite.com/auth/callback',
  state: crypto.randomUUID(),
  code_challenge: await generateCodeChallenge(verifier),
  code_challenge_method: 'S256'
});
redirect(`https://heartwood.grove.place/login?${params}`);

// 2. Handle callback - exchange code for tokens
const tokens = await fetch('https://heartwood.grove.place/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: 'https://yoursite.com/auth/callback',
    client_id: 'your-client-id',
    client_secret: env.CLIENT_SECRET,
    code_verifier: verifier
  })
}).then(r => r.json());

// 3. Verify tokens on protected routes
const user = await fetch('https://heartwood.grove.place/verify', {
  headers: { Authorization: `Bearer ${tokens.access_token}` }
}).then(r => r.json());
```

---

## Registered Clients

| Client ID | Site | Redirect URIs |
|-----------|------|---------------|
| `groveengine` | Lattice (GroveEngine) | `https://*.grove.place/auth/callback` |
| `autumnsgrove` | AutumnsGrove | `https://autumnsgrove.place/auth/callback` |

### Register a New Client

Need to add a new site to Heartwood? See **[docs/OAUTH_CLIENT_SETUP.md](docs/OAUTH_CLIENT_SETUP.md)** for the complete walkthrough:

- Generate client credentials (secret + hash)
- Set secrets on your client site via `wrangler`
- Register the client in the Heartwood database
- Troubleshoot common issues (hash format, CORS, redirects)

For AI agents integrating auth into projects, see **[docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md)**.

---

## Security

- **PKCE Required**: All OAuth flows must use Proof Key for Code Exchange
- **State Parameter**: CSRF protection via client-generated state
- **Rate Limiting**: Endpoints are rate-limited to prevent abuse
- **Secure Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Audit Logging**: All auth events are logged
- **Allowlist**: Only pre-approved emails can authenticate

---

## Project Structure

```
groveauth/
├── src/
│   ├── index.ts              # Main Hono app entry
│   ├── types.ts              # TypeScript types
│   ├── routes/
│   │   ├── login.ts          # Login page handler
│   │   ├── oauth/
│   │   │   ├── google.ts     # Google OAuth
│   │   │   └── github.ts     # GitHub OAuth
│   │   ├── magic.ts          # Magic code handlers
│   │   ├── token.ts          # Token endpoints
│   │   └── verify.ts         # Token verification
│   ├── middleware/
│   │   ├── cors.ts           # CORS handling
│   │   ├── rateLimit.ts      # Rate limiting
│   │   └── security.ts       # Security headers
│   ├── services/
│   │   ├── jwt.ts            # JWT operations
│   │   ├── oauth.ts          # OAuth helpers
│   │   ├── email.ts          # Email via Resend
│   │   └── user.ts           # User management
│   ├── db/
│   │   ├── schema.sql        # Database schema
│   │   ├── seed.sql          # Seed data
│   │   └── queries.ts        # Database queries
│   └── utils/
│       ├── crypto.ts         # Cryptographic utilities
│       ├── validation.ts     # Input validation
│       └── constants.ts      # Configuration
├── templates/
│   └── login.html            # Login page template
├── wrangler.toml
├── package.json
└── tsconfig.json
```

---

## Development

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test

# Local development (requires wrangler login)
pnpm dev
```

---

## License

MIT - AutumnsGrove

---

*See [GROVEAUTH_SPEC.md](GROVEAUTH_SPEC.md) for complete technical specification (internal codename used for file)*
