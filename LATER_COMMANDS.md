# Commands to Run Later

These commands need to be run from your local machine after you're home and ready to deploy.

---

## 1. Initial Setup (One-Time)

### Login to Cloudflare
```bash
wrangler login
```

### Create D1 Database
```bash
wrangler d1 create groveauth
```

After creating, copy the `database_id` and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "groveauth"
database_id = "YOUR_ACTUAL_DATABASE_ID"
```

---

## 2. Generate RSA Keys (Do NOT Commit These!)

```bash
# Generate 2048-bit RSA private key
openssl genrsa -out private.pem 2048

# Extract public key from private key
openssl rsa -in private.pem -pubout -out public.pem

# View the keys (optional, to verify they look correct)
cat private.pem
cat public.pem
```

---

## 3. Set Cloudflare Secrets

**IMPORTANT**: Run these one at a time, they will prompt for input.

```bash
# JWT Keys (paste the full PEM content including -----BEGIN/END----- lines)
wrangler secret put JWT_PRIVATE_KEY
# Then paste contents of private.pem and press Ctrl+D

wrangler secret put JWT_PUBLIC_KEY
# Then paste contents of public.pem and press Ctrl+D

# OAuth Credentials
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# Email Service
wrangler secret put RESEND_API_KEY
```

After setting JWT secrets, **delete the local key files**:
```bash
rm private.pem public.pem
```

---

## 4. Generate Client Secrets

You need to generate secrets for each registered client and update the seed file.

```bash
# Generate a random 32-character secret for each client
openssl rand -base64 32
```

For each client:
1. Generate a secret
2. Hash it: `echo -n "YOUR_SECRET" | openssl dgst -sha256 -binary | base64`
3. Update `src/db/seed.sql` with the hash
4. Store the unhashed secret securely (you'll give this to the client app)

Example:
```sql
-- In seed.sql, replace PLACEHOLDER_HASH_REPLACE_BEFORE_DEPLOY with actual hash
INSERT OR REPLACE INTO clients (id, name, client_id, client_secret_hash, ...)
VALUES (
  '...',
  'GroveEngine',
  'groveengine',
  'ABC123...YOUR_HASHED_SECRET...',
  ...
);
```

---

## 5. Run Database Migrations

```bash
# Run schema migration on production D1
pnpm db:migrate

# Run seed data (initial clients and allowed emails)
pnpm db:seed
```

---

## 6. Configure DNS

Add a CNAME or A record for `auth.grove.place` pointing to your Cloudflare Workers subdomain.

In Cloudflare dashboard:
1. Go to Workers & Pages > groveauth
2. Settings > Triggers > Custom Domains
3. Add `auth.grove.place`

---

## 7. Deploy

```bash
pnpm deploy
```

---

## 8. Verify Deployment

```bash
# Check health endpoint
curl https://auth.grove.place/health

# Check root endpoint
curl https://auth.grove.place/
```

---

## 9. Create OAuth Apps

### Google OAuth
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Go to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URI: `https://auth.grove.place/oauth/google/callback`
6. Copy Client ID and Client Secret

### GitHub OAuth
1. Go to https://github.com/settings/developers
2. Create New OAuth App
3. Set Authorization callback URL: `https://auth.grove.place/oauth/github/callback`
4. Copy Client ID and Client Secret

---

## 10. Set Up Resend

1. Go to https://resend.com/
2. Create account or login
3. Add and verify domain: `grove.place`
4. Create API key
5. Set the secret: `wrangler secret put RESEND_API_KEY`

---

## Quick Command Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Local development server |
| `pnpm deploy` | Deploy to Cloudflare |
| `pnpm typecheck` | Run TypeScript type checks |
| `pnpm test` | Run tests |
| `pnpm db:migrate` | Run production migrations |
| `pnpm db:seed` | Seed production database |
| `wrangler secret put NAME` | Set a secret |
| `wrangler secret list` | List all secrets |
| `wrangler d1 execute groveauth --command "SQL"` | Run SQL on production |

---

## Troubleshooting

### "Database not found"
Make sure you've created the D1 database and updated `wrangler.toml` with the correct `database_id`.

### "Invalid JWT"
- Verify RSA keys are in PEM format
- Check that both private and public keys are set as secrets
- Keys must include the `-----BEGIN/END-----` headers

### "OAuth callback failed"
- Verify redirect URIs match exactly in OAuth provider settings
- Check that client_id and client_secret are correct

### "Email not sending"
- Verify Resend API key is correct
- Check that grove.place domain is verified in Resend
- Check Resend dashboard for error logs

---

*Generated: 2025-12-08*
