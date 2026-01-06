-- Better Auth Migration for Heartwood
-- This migration adds the tables required by Better Auth while preserving existing data.
--
-- The existing `users` table is extended with new columns.
-- New tables are added for sessions, accounts, verifications, and passkeys.
--
-- Run with: wrangler d1 execute groveauth --file=./src/db/migrations/0001_better_auth.sql

-- =============================================================================
-- STEP 1: Add new columns to existing users table
-- =============================================================================

-- Better Auth expects these columns in the users table
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN image TEXT;
ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

-- Rename is_admin to follow Better Auth conventions (optional, for consistency)
-- Note: We keep the existing column and add a new one for compatibility
ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;

-- =============================================================================
-- STEP 2: Create Better Auth sessions table
-- =============================================================================

-- This replaces the legacy D1 sessions and complements the SessionDO
-- Better Auth will use this for primary session storage with KV caching
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- Request metadata
    ip_address TEXT,
    user_agent TEXT,

    -- Cloudflare geolocation (via better-auth-cloudflare)
    country TEXT,
    city TEXT,
    region TEXT,
    timezone TEXT,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- =============================================================================
-- STEP 3: Create accounts table for OAuth provider connections
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,           -- Provider's user ID
    provider_id TEXT NOT NULL,           -- 'google', 'github', etc.
    access_token TEXT,
    refresh_token TEXT,
    access_token_expires_at INTEGER,
    refresh_token_expires_at INTEGER,
    scope TEXT,
    id_token TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider_id, account_id);

-- =============================================================================
-- STEP 4: Create verifications table for magic links
-- =============================================================================

CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,           -- Email address
    value TEXT NOT NULL,                 -- Token value
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON verifications(identifier);
CREATE INDEX IF NOT EXISTS idx_verifications_expires_at ON verifications(expires_at);

-- =============================================================================
-- STEP 5: Create passkeys table for WebAuthn
-- =============================================================================

CREATE TABLE IF NOT EXISTS passkeys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,                           -- User-provided name
    public_key TEXT NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    counter INTEGER NOT NULL DEFAULT 0,
    device_type TEXT,                    -- 'singleDevice' or 'multiDevice'
    backed_up INTEGER DEFAULT 0,
    transports TEXT,                     -- JSON array
    created_at INTEGER NOT NULL,
    aaguid TEXT,                         -- Authenticator GUID

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkeys(credential_id);

-- =============================================================================
-- STEP 6: Migrate existing user data to new format
-- =============================================================================

-- Update timestamp format for existing users (ISO string to Unix timestamp)
-- This is a no-op if the data is already in the correct format
-- Better Auth uses INTEGER timestamps, but we'll handle this in the application layer

-- =============================================================================
-- NOTES
-- =============================================================================
--
-- The following existing tables are preserved and will continue to work:
-- - clients: OAuth client applications
-- - allowed_emails: Email allowlist
-- - audit_log: Security audit trail
-- - user_subscriptions: Subscription management
-- - subscription_audit_log: Subscription change tracking
-- - oauth_states: Temporary OAuth flow state
-- - auth_codes: Authorization codes (legacy flow)
-- - refresh_tokens: JWT refresh tokens (legacy flow)
-- - magic_codes: Email verification codes (legacy flow)
-- - rate_limits: Rate limiting
-- - failed_attempts: Login attempt tracking
-- - user_sessions: Legacy D1 sessions
-- - user_client_preferences: Client preferences
--
-- The SessionDO (Durable Object) will continue to work for existing sessions
-- but new sessions will use the Better Auth sessions table with KV caching.
