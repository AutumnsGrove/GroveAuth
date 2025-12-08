/**
 * GroveAuth Frontend Configuration
 * API URL defaults to the production auth service
 */

export const AUTH_API_URL = 'https://auth.grove.place';

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
    health: '/health'
  }
};
