/**
 * Heartwood Frontend Configuration
 * API URL points to the internal Cloudflare Worker backend (groveauth worker)
 * Note: auth-api.grove.place is the internal API endpoint, not the public domain
 */

export const AUTH_API_URL = 'https://auth-api.grove.place';

export const config = {
  apiUrl: AUTH_API_URL,
  endpoints: {
    // Better Auth endpoints (new, recommended)
    betterAuth: {
      signInSocial: '/api/auth/sign-in/social',
      signInMagicLink: '/api/auth/sign-in/magic-link',
      signInPasskey: '/api/auth/sign-in/passkey',
      signOut: '/api/auth/sign-out',
      session: '/api/auth/session',
      passkeyRegister: '/api/auth/passkey/register',
      passkeyList: '/api/auth/passkey/list',
      callbackGoogle: '/api/auth/callback/google',
    },
    // Legacy endpoints (maintained for backwards compatibility)
    login: '/login',
    oauthGoogle: '/oauth/google',
    magicSend: '/magic/send',
    magicVerify: '/magic/verify',
    token: '/token',
    tokenRefresh: '/token/refresh',
    verify: '/verify',
    userinfo: '/userinfo',
    logout: '/logout',
    health: '/health',
    sessionCheck: '/session/check',
    adminStats: '/admin/stats',
    adminUsers: '/admin/users',
    adminAuditLog: '/admin/audit-log',
    adminClients: '/admin/clients',
    // Session management endpoints
    sessionValidate: '/session/validate',
    sessionRevoke: '/session/revoke',
    sessionRevokeAll: '/session/revoke-all',
    sessionList: '/session/list',
    // Minecraft endpoints
    minecraftStatus: '/minecraft/status',
    minecraftStart: '/minecraft/start',
    minecraftStop: '/minecraft/stop',
    minecraftWhitelist: '/minecraft/whitelist',
    minecraftCommand: '/minecraft/command',
    minecraftSync: '/minecraft/sync',
    minecraftHistory: '/minecraft/history',
  }
};
