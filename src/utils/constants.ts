/**
 * Application constants and configuration
 */

// Token expiration times
export const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour in seconds
export const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds
export const AUTH_CODE_EXPIRY = 5 * 60; // 5 minutes in seconds
export const MAGIC_CODE_EXPIRY = 10 * 60; // 10 minutes in seconds

// Rate limiting
export const RATE_LIMIT_MAGIC_SEND_PER_EMAIL = 3; // per minute
export const RATE_LIMIT_MAGIC_SEND_PER_IP = 10; // per minute
export const RATE_LIMIT_TOKEN_PER_CLIENT = 20; // per minute
export const RATE_LIMIT_VERIFY_PER_CLIENT = 100; // per minute
export const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds

// Lockout settings
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

// OAuth URLs
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_USERINFO_URL = 'https://api.github.com/user';
export const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

// Resend
export const RESEND_API_URL = 'https://api.resend.com/emails';
export const EMAIL_FROM = 'GroveAuth <auth@grove.place>';

// Security headers
export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'",
};

// Allowed OAuth scopes
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'];
export const GITHUB_SCOPES = ['user:email', 'read:user'];

// JWT settings
export const JWT_ALGORITHM = 'RS256';
export const JWT_ISSUER = 'https://auth.grove.place';
