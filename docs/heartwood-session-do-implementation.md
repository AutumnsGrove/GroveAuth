# Heartwood: SessionDO Implementation Guide

## Overview

This document describes the implementation of `SessionDO` for Heartwood, Grove's authentication system. The goal is to create a robust, fast, and reliable session management system that:

1. Eliminates the current 15-second login delay
2. Provides atomic session operations (no race conditions)
3. Enables cross-subdomain auth for all Grove tenants
4. Exposes a simple API for consuming projects

After implementation, any Grove project authenticates by calling Heartwood's API — they don't implement their own session logic.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

User clicks "Login with Google"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Heartwood Worker (grove-auth)                                           │
│  POST /auth/google/start                                                │
│  - Generate state, store in KV (short-lived, this is fine for KV)      │
│  - Redirect to Google OAuth                                             │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Google OAuth                                                            │
│  - User authenticates                                                   │
│  - Redirects back with code                                             │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Heartwood Worker (grove-auth)                                           │
│  GET /auth/google/callback                                              │
│  - Exchange code for tokens                                             │
│  - Get user info from Google                                            │
│  - Upsert user in D1                                                    │
│  - Create session in SessionDO ◄─── THIS IS THE KEY PART               │
│  - Set cookie, redirect to destination                                  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SessionDO (id: session:{userId})                                        │
│  - Stores session with device info                                      │
│  - Returns session ID                                                   │
│  - Handles all future validation requests                               │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Any Grove Site (alice.grove.place, etc.)                                │
│  - Has cookie: grove_session={sessionId}:{userId}                       │
│  - Calls Heartwood API to validate                                      │
│  - OR calls SessionDO directly via service binding                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Cookie Design

The session cookie contains enough information to route to the correct SessionDO without a lookup:

```
grove_session={sessionId}:{userId}:{signature}

Example:
grove_session=abc123def456:user_789xyz:hmac_signature_here
```

**Components:**
- `sessionId`: Random UUID identifying this specific session
- `userId`: The user's ID (needed to find their SessionDO)
- `signature`: HMAC-SHA256 of `{sessionId}:{userId}` with a secret key

**Cookie attributes:**
```
Path=/
HttpOnly
Secure
SameSite=Lax
Domain=.grove.place    ← This enables cross-subdomain auth
Max-Age=2592000        ← 30 days
```

**Why include userId in the cookie?**

Without it, you'd need a global lookup to find which user owns a session. That's either:
- A D1 query on every request (slow)
- A global "session router" DO that becomes a bottleneck

By encoding the userId in the cookie (signed to prevent tampering), any worker can compute the DO ID directly: `session:{userId}`.

---

## SessionDO Implementation

### File Structure

```
grove-auth/
├── src/
│   ├── durables/
│   │   └── SessionDO.ts       ← The Durable Object class
│   ├── lib/
│   │   ├── session.ts         ← Session utilities (cookie parsing, signing)
│   │   └── auth.ts            ← OAuth helpers
│   ├── routes/
│   │   ├── google.ts          ← Google OAuth routes
│   │   ├── session.ts         ← Session management routes (validate, revoke, list)
│   │   └── ...
│   └── index.ts               ← Worker entry point
├── wrangler.toml
└── package.json
```

### wrangler.toml

```toml
name = "grove-auth"
main = "src/index.ts"
compatibility_date = "2024-12-01"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "grove-auth"
database_id = "your-database-id"

# Durable Objects
[[durable_objects.bindings]]
name = "SESSIONS"
class_name = "SessionDO"

# KV for short-lived OAuth state (this is fine for KV - it's temporary and we don't need consistency)
[[kv_namespaces]]
binding = "OAUTH_STATE"
id = "your-kv-id"

# Secrets (set via wrangler secret put)
# SESSION_SECRET - for signing cookies
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET

[[migrations]]
tag = "v1"
new_sqlite_classes = ["SessionDO"]
```

### SessionDO.ts

```typescript
import { DurableObject } from "cloudflare:workers";

interface Session {
  id: string;
  deviceId: string;
  deviceName: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  ipAddress: string | null;
  userAgent: string | null;
}

interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
}

export class SessionDO extends DurableObject<Env> {
  private userId: string | null = null;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async initialize() {
    if (this.initialized) return;

    // Create tables if they don't exist
    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_name TEXT,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_sessions_expires 
        ON sessions(expires_at);
      
      CREATE INDEX IF NOT EXISTS idx_sessions_device 
        ON sessions(device_id);
    `);

    // Rate limiting table
    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL
      );
    `);

    // Extract userId from DO name (set during first operation)
    this.initialized = true;
  }

  /**
   * Create a new session for this user
   */
  async createSession(params: {
    deviceId: string;
    deviceName: string;
    ipAddress: string | null;
    userAgent: string | null;
    expiresInSeconds: number;
  }): Promise<{ sessionId: string }> {
    await this.initialize();

    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + params.expiresInSeconds * 1000;

    await this.ctx.storage.sql.exec(
      `INSERT INTO sessions (id, device_id, device_name, created_at, last_active_at, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      sessionId,
      params.deviceId,
      params.deviceName,
      now,
      now,
      expiresAt,
      params.ipAddress,
      params.userAgent
    );

    // Set cleanup alarm for when this session expires
    await this.scheduleCleanup();

    console.log(`[SessionDO] Created session ${sessionId} for device ${params.deviceId}`);

    return { sessionId };
  }

  /**
   * Validate a session and optionally update last active time
   */
  async validateSession(sessionId: string, updateLastActive = true): Promise<{
    valid: boolean;
    session?: Session;
  }> {
    await this.initialize();

    const now = Date.now();
    
    const result = await this.ctx.storage.sql.exec(
      `SELECT * FROM sessions WHERE id = ? AND expires_at > ?`,
      sessionId,
      now
    ).toArray();

    if (result.length === 0) {
      return { valid: false };
    }

    const row = result[0];
    const session: Session = {
      id: row.id as string,
      deviceId: row.device_id as string,
      deviceName: row.device_name as string,
      createdAt: row.created_at as number,
      lastActiveAt: row.last_active_at as number,
      expiresAt: row.expires_at as number,
      ipAddress: row.ip_address as string | null,
      userAgent: row.user_agent as string | null,
    };

    // Update last active (but not on every request - throttle to once per minute)
    if (updateLastActive && now - session.lastActiveAt > 60_000) {
      await this.ctx.storage.sql.exec(
        `UPDATE sessions SET last_active_at = ? WHERE id = ?`,
        now,
        sessionId
      );
      session.lastActiveAt = now;
    }

    return { valid: true, session };
  }

  /**
   * Revoke a specific session (logout from one device)
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    await this.initialize();

    const result = await this.ctx.storage.sql.exec(
      `DELETE FROM sessions WHERE id = ?`,
      sessionId
    );

    console.log(`[SessionDO] Revoked session ${sessionId}`);

    return result.rowsWritten > 0;
  }

  /**
   * Revoke all sessions except optionally the current one (logout from all devices)
   */
  async revokeAllSessions(exceptSessionId?: string): Promise<number> {
    await this.initialize();

    let result;
    if (exceptSessionId) {
      result = await this.ctx.storage.sql.exec(
        `DELETE FROM sessions WHERE id != ?`,
        exceptSessionId
      );
    } else {
      result = await this.ctx.storage.sql.exec(`DELETE FROM sessions`);
    }

    console.log(`[SessionDO] Revoked ${result.rowsWritten} sessions`);

    return result.rowsWritten;
  }

  /**
   * List all active sessions (for "manage devices" UI)
   */
  async listSessions(): Promise<Session[]> {
    await this.initialize();

    const now = Date.now();
    const rows = await this.ctx.storage.sql.exec(
      `SELECT * FROM sessions WHERE expires_at > ? ORDER BY last_active_at DESC`,
      now
    ).toArray();

    return rows.map((row) => ({
      id: row.id as string,
      deviceId: row.device_id as string,
      deviceName: row.device_name as string,
      createdAt: row.created_at as number,
      lastActiveAt: row.last_active_at as number,
      expiresAt: row.expires_at as number,
      ipAddress: row.ip_address as string | null,
      userAgent: row.user_agent as string | null,
    }));
  }

  /**
   * Check rate limit for login attempts
   */
  async checkLoginRateLimit(): Promise<{
    allowed: boolean;
    remainingAttempts: number;
    resetAt: number | null;
  }> {
    await this.initialize();

    const MAX_ATTEMPTS = 5;
    const WINDOW_SECONDS = 300; // 5 minutes
    const LOCKOUT_SECONDS = 900; // 15 minutes

    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    // Get current rate limit state
    const result = await this.ctx.storage.sql.exec(
      `SELECT count, window_start FROM rate_limits WHERE key = 'login'`
    ).toArray();

    let count = 0;
    let currentWindowStart = now;

    if (result.length > 0) {
      const row = result[0];
      if ((row.window_start as number) > windowStart) {
        // Still in current window
        count = row.count as number;
        currentWindowStart = row.window_start as number;
      }
      // Else: window expired, reset
    }

    if (count >= MAX_ATTEMPTS) {
      const resetAt = currentWindowStart + LOCKOUT_SECONDS * 1000;
      if (now < resetAt) {
        return {
          allowed: false,
          remainingAttempts: 0,
          resetAt,
        };
      }
      // Lockout expired, reset
      count = 0;
      currentWindowStart = now;
    }

    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - count,
      resetAt: null,
    };
  }

  /**
   * Record a login attempt (success or failure)
   */
  async recordLoginAttempt(success: boolean): Promise<void> {
    await this.initialize();

    if (success) {
      // Reset on successful login
      await this.ctx.storage.sql.exec(
        `DELETE FROM rate_limits WHERE key = 'login'`
      );
    } else {
      // Increment failure count
      const now = Date.now();
      await this.ctx.storage.sql.exec(
        `INSERT INTO rate_limits (key, count, window_start) VALUES ('login', 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = count + 1`,
        now
      );
    }
  }

  /**
   * Schedule cleanup alarm
   */
  private async scheduleCleanup() {
    // Find the earliest expiring session
    const result = await this.ctx.storage.sql.exec(
      `SELECT MIN(expires_at) as earliest FROM sessions`
    ).toArray();

    if (result.length > 0 && result[0].earliest) {
      const earliest = result[0].earliest as number;
      // Schedule alarm slightly after expiration
      await this.ctx.storage.setAlarm(earliest + 1000);
    }
  }

  /**
   * Alarm handler - clean up expired sessions
   */
  async alarm() {
    await this.initialize();

    const now = Date.now();
    
    // Delete expired sessions
    const result = await this.ctx.storage.sql.exec(
      `DELETE FROM sessions WHERE expires_at < ?`,
      now
    );

    console.log(`[SessionDO] Cleaned up ${result.rowsWritten} expired sessions`);

    // Check if any sessions remain
    const remaining = await this.ctx.storage.sql.exec(
      `SELECT COUNT(*) as count FROM sessions`
    ).toArray();

    if ((remaining[0].count as number) === 0) {
      // No sessions left - this DO can be cleaned up
      // Optionally delete all storage to free up space
      console.log(`[SessionDO] No sessions remaining, clearing storage`);
      await this.ctx.storage.sql.exec(`DELETE FROM rate_limits`);
      // The DO will hibernate and eventually be garbage collected
    } else {
      // Schedule next cleanup
      await this.scheduleCleanup();
    }
  }
}
```

---

## Session Utilities

### src/lib/session.ts

```typescript
import { createHmac } from "node:crypto";

export interface ParsedSessionCookie {
  sessionId: string;
  userId: string;
  signature: string;
}

/**
 * Create a signed session cookie value
 */
export function createSessionCookie(
  sessionId: string,
  userId: string,
  secret: string
): string {
  const payload = `${sessionId}:${userId}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}:${signature}`;
}

/**
 * Parse and verify a session cookie
 */
export function parseSessionCookie(
  cookie: string,
  secret: string
): ParsedSessionCookie | null {
  const parts = cookie.split(":");
  if (parts.length !== 3) return null;

  const [sessionId, userId, signature] = parts;
  
  // Verify signature
  const payload = `${sessionId}:${userId}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (signature !== expectedSignature) {
    console.log("[Session] Invalid cookie signature");
    return null;
  }

  return { sessionId, userId, signature };
}

/**
 * Get session cookie from request
 */
export function getSessionFromRequest(
  request: Request,
  secret: string
): ParsedSessionCookie | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...value] = c.trim().split("=");
      return [key, value.join("=")];
    })
  );

  const sessionCookie = cookies["grove_session"];
  if (!sessionCookie) return null;

  return parseSessionCookie(sessionCookie, secret);
}

/**
 * Generate Set-Cookie header for session
 */
export function createSessionCookieHeader(
  sessionId: string,
  userId: string,
  secret: string,
  maxAgeSeconds: number = 30 * 24 * 60 * 60 // 30 days
): string {
  const value = createSessionCookie(sessionId, userId, secret);
  return `grove_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=.grove.place; Max-Age=${maxAgeSeconds}`;
}

/**
 * Generate device ID from request (fingerprint)
 */
export function getDeviceId(request: Request): string {
  // Simple fingerprint from available headers
  const components = [
    request.headers.get("user-agent") || "",
    request.headers.get("accept-language") || "",
    request.headers.get("cf-connecting-ip") || "",
  ];
  
  const hash = createHmac("sha256", "device-fingerprint")
    .update(components.join("|"))
    .digest("hex")
    .substring(0, 16);

  return hash;
}

/**
 * Parse user agent into friendly device name
 */
export function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown Device";

  // Simple parsing - can be expanded
  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("iPad")) return "iPad";
  if (userAgent.includes("Android")) return "Android Device";
  if (userAgent.includes("Mac OS")) {
    if (userAgent.includes("Chrome")) return "Chrome on Mac";
    if (userAgent.includes("Safari")) return "Safari on Mac";
    if (userAgent.includes("Firefox")) return "Firefox on Mac";
    return "Mac";
  }
  if (userAgent.includes("Windows")) {
    if (userAgent.includes("Chrome")) return "Chrome on Windows";
    if (userAgent.includes("Firefox")) return "Firefox on Windows";
    if (userAgent.includes("Edge")) return "Edge on Windows";
    return "Windows PC";
  }
  if (userAgent.includes("Linux")) return "Linux";

  return "Unknown Device";
}
```

---

## API Routes

### src/routes/session.ts

These are the routes that other Grove projects will call.

```typescript
import { Hono } from "hono";
import { getSessionFromRequest, createSessionCookieHeader, getDeviceId, parseDeviceName } from "../lib/session";

interface Env {
  DB: D1Database;
  SESSIONS: DurableObjectNamespace;
  SESSION_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /session/validate
 * 
 * Validate a session. Called by other Grove projects to check if a user is authenticated.
 * 
 * Request: { sessionCookie: string } or uses Cookie header
 * Response: { valid: boolean, user?: { id, email, name } }
 */
app.post("/session/validate", async (c) => {
  const session = getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);
  
  if (!session) {
    return c.json({ valid: false });
  }

  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${session.userId}`)
  );

  const result = await sessionDO.validateSession(session.sessionId);
  
  if (!result.valid) {
    return c.json({ valid: false });
  }

  // Fetch user data from D1
  const user = await c.env.DB.prepare(
    "SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?"
  ).bind(session.userId).first();

  if (!user) {
    return c.json({ valid: false });
  }

  return c.json({
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    },
    session: {
      id: session.sessionId,
      deviceName: result.session?.deviceName,
      lastActiveAt: result.session?.lastActiveAt,
    },
  });
});

/**
 * POST /session/revoke
 * 
 * Revoke the current session (logout).
 */
app.post("/session/revoke", async (c) => {
  const session = getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);
  
  if (!session) {
    return c.json({ success: false, error: "No session" }, 401);
  }

  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${session.userId}`)
  );

  await sessionDO.revokeSession(session.sessionId);

  // Clear cookie
  return c.json({ success: true }, {
    headers: {
      "Set-Cookie": "grove_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=.grove.place; Max-Age=0",
    },
  });
});

/**
 * POST /session/revoke-all
 * 
 * Revoke all sessions except current (logout from all devices).
 */
app.post("/session/revoke-all", async (c) => {
  const session = getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);
  
  if (!session) {
    return c.json({ success: false, error: "No session" }, 401);
  }

  const { keepCurrent } = await c.req.json<{ keepCurrent?: boolean }>();

  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${session.userId}`)
  );

  const count = await sessionDO.revokeAllSessions(
    keepCurrent ? session.sessionId : undefined
  );

  return c.json({ success: true, revokedCount: count });
});

/**
 * GET /session/list
 * 
 * List all active sessions for the current user.
 */
app.get("/session/list", async (c) => {
  const session = getSessionFromRequest(c.req.raw, c.env.SESSION_SECRET);
  
  if (!session) {
    return c.json({ sessions: [] }, 401);
  }

  const sessionDO = c.env.SESSIONS.get(
    c.env.SESSIONS.idFromName(`session:${session.userId}`)
  );

  const sessions = await sessionDO.listSessions();

  // Mark the current session
  const sessionsWithCurrent = sessions.map((s) => ({
    ...s,
    isCurrent: s.id === session.sessionId,
  }));

  return c.json({ sessions: sessionsWithCurrent });
});

export default app;
```

---

## Consuming from Other Grove Projects

### Option 1: HTTP API (Simplest)

Any Grove project can validate sessions by calling Heartwood's API:

```typescript
// In alice.grove.place worker

async function validateSession(request: Request, env: Env): Promise<User | null> {
  const response = await fetch("https://auth.grove.place/session/validate", {
    method: "POST",
    headers: {
      Cookie: request.headers.get("Cookie") || "",
    },
  });

  const result = await response.json<{ valid: boolean; user?: User }>();
  
  if (!result.valid) return null;
  return result.user;
}

// Usage in route handler
app.get("/dashboard", async (c) => {
  const user = await validateSession(c.req.raw, c.env);
  if (!user) {
    return c.redirect("https://auth.grove.place/login?redirect=" + encodeURIComponent(c.req.url));
  }
  
  // User is authenticated
  return c.html(renderDashboard(user));
});
```

### Option 2: Service Binding (Faster, No Network Hop)

If projects are in the same Cloudflare account, use service bindings:

```toml
# In alice.grove.place wrangler.toml
[[services]]
binding = "AUTH"
service = "grove-auth"
```

```typescript
// In alice.grove.place worker

async function validateSession(request: Request, env: Env): Promise<User | null> {
  // Direct service binding call - no external network
  const response = await env.AUTH.fetch("https://auth.grove.place/session/validate", {
    method: "POST",
    headers: {
      Cookie: request.headers.get("Cookie") || "",
    },
  });

  const result = await response.json();
  if (!result.valid) return null;
  return result.user;
}
```

### Option 3: Direct DO Access (Fastest, More Coupling)

If you need maximum performance, you can expose the SESSIONS DO via service binding:

```toml
# In grove-auth wrangler.toml
[[durable_objects.bindings]]
name = "SESSIONS"
class_name = "SessionDO"
# Export for external access
script_name = "grove-auth"
```

```typescript
// This requires more setup and couples projects more tightly
// Recommend starting with Option 1 or 2
```

---

## Client-Side Integration

### Login Flow

```typescript
// In any Grove frontend

function login(provider: "google" | "github") {
  const returnUrl = window.location.href;
  window.location.href = `https://auth.grove.place/auth/${provider}/start?redirect=${encodeURIComponent(returnUrl)}`;
}

function logout() {
  fetch("https://auth.grove.place/session/revoke", {
    method: "POST",
    credentials: "include", // Important: sends cookies cross-origin
  }).then(() => {
    window.location.href = "/";
  });
}
```

### Session Check (SvelteKit Example)

```typescript
// In +layout.server.ts

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ fetch, cookies }) => {
  const sessionCookie = cookies.get("grove_session");
  if (!sessionCookie) {
    return { user: null };
  }

  try {
    const response = await fetch("https://auth.grove.place/session/validate", {
      method: "POST",
      headers: {
        Cookie: `grove_session=${sessionCookie}`,
      },
    });

    const result = await response.json();
    
    if (!result.valid) {
      return { user: null };
    }

    return { user: result.user };
  } catch (error) {
    console.error("Session validation failed:", error);
    return { user: null };
  }
};
```

---

## Migration Checklist

### Phase 1: Implement SessionDO

- [ ] Create `src/durables/SessionDO.ts` with the implementation above
- [ ] Create `src/lib/session.ts` with utilities
- [ ] Update `wrangler.toml` with DO binding and migration
- [ ] Deploy and verify DO is created

### Phase 2: Update OAuth Callback

- [ ] Modify Google callback to create session in SessionDO
- [ ] Set cookie with new format: `{sessionId}:{userId}:{signature}`
- [ ] Test login flow end-to-end

### Phase 3: Add Session Management Routes

- [ ] Implement `/session/validate`
- [ ] Implement `/session/revoke`
- [ ] Implement `/session/revoke-all`
- [ ] Implement `/session/list`
- [ ] Test from external client

### Phase 4: Update Consuming Projects

- [ ] Update Grove Engine to use new validation API
- [ ] Update any other projects that check auth
- [ ] Remove old session checking logic

### Phase 5: Add Device Management UI

- [ ] Add "Manage Devices" page to admin.grove.place
- [ ] Show list of active sessions
- [ ] Allow revoking individual sessions
- [ ] Allow "Log out everywhere"

---

## Security Considerations

### Cookie Signing

The session cookie is signed with HMAC-SHA256. This prevents:
- Tampering with the userId (to access another user's session)
- Forging session cookies

The secret must be:
- At least 32 bytes of random data
- Stored as a Cloudflare secret: `wrangler secret put SESSION_SECRET`
- Rotated periodically (implement key versioning for graceful rotation)

### Rate Limiting

The SessionDO implements rate limiting on login attempts:
- 5 failed attempts → 15 minute lockout
- Per-user, not per-IP (prevents distributed attacks)

### Session Expiration

- Sessions expire after 30 days by default
- The DO cleans up expired sessions via alarms
- Consider shorter expiration for sensitive operations (force re-auth)

### Token Storage

OAuth refresh tokens should be encrypted at rest if stored. Consider:
- Using Cloudflare's built-in encryption for secrets
- Or encrypting the refresh token before storing in DO

---

## Performance Expectations

After implementation:

| Operation | Before (D1) | After (SessionDO) |
|-----------|-------------|-------------------|
| Login complete | ~15 seconds | ~2-3 seconds |
| Session validation | ~50-100ms | ~5-10ms |
| List sessions | ~100ms | ~5-10ms |
| Logout | ~50ms | ~5ms |

The improvements come from:
1. Eliminating D1 queries on hot path
2. In-memory caching in DO
3. Single coordination point (no worker-to-worker handoff)
4. Cookie contains routing info (no lookup needed)

---

## Debugging

### Tail Logs

```bash
wrangler tail grove-auth --format=pretty
```

### Check DO Storage

In Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select grove-auth
3. Go to Durable Objects
4. Find the SessionDO class
5. Click on a specific instance (by ID)
6. View storage in Data Studio

### Common Issues

**"Session not found" after login:**
- Check cookie is being set with correct Domain (.grove.place)
- Verify cookie signature matches

**"Rate limited" immediately:**
- Check rate_limits table in DO
- Clear via alarm or manual intervention

**DO not waking up:**
- Check wrangler.toml migration tag
- Verify class_name matches exactly

---

## Better Auth Session Bridge

*Added 2026-01-31*

### The Problem

Better Auth handles OAuth, magic links, and passkeys beautifully. When a user signs in via Google, BA creates a `ba_session` in D1 and sets a `better-auth.session_token` cookie.

But this creates two separate session systems:
- **BA sessions**: Created by OAuth/magic links/passkeys, stored in D1
- **SessionDO sessions**: Our fast, device-aware session system

OAuth users only got BA sessions. They couldn't see their devices in `/session/list`. The validation cascade had to check multiple places.

### The Solution: Session Bridge

When BA creates a session, we also create a SessionDO session. Both cookies get set. SessionDO becomes the primary session system while BA handles the auth *flows*.

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER CLICKS "SIGN IN WITH GOOGLE"                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BETTER AUTH                                                        │
│  1. Redirect to Google OAuth                                        │
│  2. Handle callback, verify tokens                                  │
│  3. Create ba_session in D1                                         │
│                              │                                      │
│                              ▼                                      │
│  ════════════════════════════════════════════════════════════════   │
│  ║  SESSION BRIDGE (databaseHooks.session.create.after)          ║  │
│  ║  • Get SessionDO for user                                     ║  │
│  ║  • Call sessionDO.createSession()                             ║  │
│  ║  • Store sessionId for response wrapper                       ║  │
│  ════════════════════════════════════════════════════════════════   │
│                              │                                      │
│  4. Set better-auth.session_token cookie                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RESPONSE WRAPPER (in betterAuth.ts)                                │
│  • Read sessionId from bridge result                                │
│  • Create grove_session cookie                                      │
│  • Append to response                                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  USER BROWSER                                                       │
│  Cookies set:                                                       │
│  • better-auth.session_token (BA's internal state)                  │
│  • grove_session (SessionDO - primary session)                      │
└─────────────────────────────────────────────────────────────────────┘
```

### How It Works

**Three files coordinate the bridge:**

1. **`src/lib/sessionBridge.ts`** — Per-request state management
   - `registerRequestForBridge()` — Called before BA handler, stores env context
   - `bridgeSessionToSessionDO()` — Creates the SessionDO session
   - `getSessionBridgeResult()` — Retrieves sessionId for cookie creation

2. **`src/auth/index.ts`** — BA configuration with hook
   ```typescript
   databaseHooks: {
     session: {
       create: {
         after: async (session, context) => {
           const request = context?.request;
           if (!request) return;

           const reqContext = getRequestContext(request);
           if (!reqContext) return;

           await bridgeSessionToSessionDO(request, session, reqContext.env);
         },
       },
     },
   },
   ```

3. **`src/routes/betterAuth.ts`** — Response wrapper
   ```typescript
   // Before BA handler
   registerRequestForBridge(c.req.raw, c.env);

   // After BA handler
   const bridgeResult = getSessionBridgeResult(c.req.raw);
   if (bridgeResult?.sessionId) {
     const cookieHeader = await createSessionCookieHeader(...);
     // Append to response
   }
   ```

### Why WeakMap?

The bridge uses WeakMaps keyed on Request objects:

```typescript
const pendingRequests = new WeakMap<Request, PendingRequestContext>();
const pendingBridges = new WeakMap<Request, SessionBridgeResult>();
```

This pattern works because:
- Each HTTP request gets a unique Request object
- WeakMap doesn't prevent garbage collection
- No cleanup needed—memory freed when request completes
- Thread-safe (each request is isolated)

### Error Handling

The bridge is fault-tolerant. If SessionDO creation fails:
- BA session still works (user is authenticated)
- Error is logged, not thrown
- Fallback cascade catches BA sessions

```typescript
} catch (error) {
  console.error('[SessionBridge] Failed:', error);
  // Don't throw - BA session is still valid
  return { sessionId: '', userId, error: error.message };
}
```

### Testing the Bridge

After OAuth login, check both cookies:

```bash
# In browser dev tools, check cookies for .grove.place:
# ✅ better-auth.session_token — BA's session
# ✅ grove_session — SessionDO session

# Verify SessionDO session works:
curl -H "Cookie: grove_session=..." https://auth-api.grove.place/session/list
```

### Migration Path

**Existing BA sessions** continue working via the validation cascade. The bridge only affects *new* logins.

After ~7 days (BA session expiry), most users will have fresh sessions with both cookies. The cascade catches stragglers.

---

*The bridge connects two forests—BA handles the journey, SessionDO manages the destination.*
