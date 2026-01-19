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

// Session rate limiting
export const RATE_LIMIT_SESSION_VALIDATE = 30; // per minute
export const RATE_LIMIT_SESSION_REVOKE = 30; // per minute
export const RATE_LIMIT_SESSION_REVOKE_ALL = 3; // per hour
export const RATE_LIMIT_SESSION_REVOKE_ALL_WINDOW = 3600; // 1 hour in seconds
export const RATE_LIMIT_SESSION_LIST = 30; // per minute
export const RATE_LIMIT_SESSION_DELETE = 20; // per minute
export const RATE_LIMIT_SESSION_CHECK = 60; // per minute
export const RATE_LIMIT_SESSION_SERVICE = 100; // per minute for internal services

// Admin rate limiting
export const RATE_LIMIT_ADMIN_PER_IP = 30; // per minute

// Pagination limits
export const ADMIN_PAGINATION_MAX_LIMIT = 100;
export const ADMIN_PAGINATION_DEFAULT_LIMIT = 50;

// Lockout settings
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

// OAuth URLs
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';


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

// JWT settings
export const JWT_ALGORITHM = 'RS256';
export const JWT_ISSUER = 'https://auth.grove.place';

// Device Code Flow (RFC 8628)
export const DEVICE_CODE_EXPIRY = 900; // 15 minutes in seconds
export const DEVICE_CODE_POLL_INTERVAL = 5; // Minimum seconds between polls
export const DEVICE_CODE_SLOW_DOWN_INCREMENT = 5; // Seconds added when slow_down triggered
// Character set: No vowels (avoid profanity), no confusables (0/O, 1/I/L)
export const DEVICE_CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ23456789';
export const USER_CODE_LENGTH = 8; // Format: XXXX-XXXX (displayed with hyphen)
export const RATE_LIMIT_DEVICE_INIT = 10; // Per minute per IP
export const RATE_LIMIT_DEVICE_POLL = 12; // Per minute per device_code
