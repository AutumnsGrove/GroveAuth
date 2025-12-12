/**
 * Heartwood Frontend Configuration
 * API URL points to the internal Cloudflare Worker backend (groveauth worker)
 * Note: auth-api.grove.place is the internal API endpoint, not the public domain
 */

export const AUTH_API_URL = 'https://auth-api.grove.place';

export const config = {
  apiUrl: AUTH_API_URL,
  endpoints: {
    login: '/login',
    oauthGoogle: '/oauth/google',
    oauthGithub: '/oauth/github',
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
