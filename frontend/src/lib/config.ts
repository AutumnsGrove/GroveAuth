/**
 * GroveAuth Frontend Configuration
 * API URL points to the Cloudflare Worker backend
 */

export const AUTH_API_URL = 'https://groveauth.m7jv4v7npb.workers.dev';

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
  }
};
