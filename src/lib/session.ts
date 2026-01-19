/**
 * Session Utilities for SessionDO
 * Uses Web Crypto API for HMAC-SHA256 signing
 */

export interface ParsedSessionCookie {
  sessionId: string;
  userId: string;
  signature: string;
}

/**
 * Base64 URL encode (no padding, URL-safe characters)
 */
function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Import secret as HMAC key for crypto.subtle
 */
async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Sign data with HMAC-SHA256 using Web Crypto API
 */
async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const signature = await crypto.subtle.sign('HMAC', key, dataBuffer);

  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Avoids early returns that could leak length information
 */
function timingSafeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Accumulate length difference
  for (let i = 0; i < maxLength; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

/**
 * Create a signed session cookie value
 * Format: {sessionId}:{userId}:{signature}
 */
export async function createSessionCookie(
  sessionId: string,
  userId: string,
  secret: string
): Promise<string> {
  const payload = `${sessionId}:${userId}`;
  const signature = await hmacSign(payload, secret);
  return `${payload}:${signature}`;
}

/**
 * Parse and verify a session cookie
 * Returns null if invalid or signature doesn't match
 */
export async function parseSessionCookie(
  cookie: string,
  secret: string
): Promise<ParsedSessionCookie | null> {
  const parts = cookie.split(':');
  if (parts.length !== 3) return null;

  const [sessionId, userId, providedSignature] = parts;

  // Verify signature
  const payload = `${sessionId}:${userId}`;
  const expectedSignature = await hmacSign(payload, secret);

  // Timing-safe comparison
  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    console.log('[Session] Invalid cookie signature');
    return null;
  }

  return { sessionId, userId, signature: providedSignature };
}

/**
 * Get session cookie from request
 */
export async function getSessionFromRequest(
  request: Request,
  secret: string
): Promise<ParsedSessionCookie | null> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...value] = c.trim().split('=');
      return [key, value.join('=')];
    })
  );

  const sessionCookie = cookies['grove_session'];
  if (!sessionCookie) return null;

  return parseSessionCookie(sessionCookie, secret);
}

/**
 * Generate Set-Cookie header for session
 * Domain: .grove.place for cross-subdomain auth
 */
export async function createSessionCookieHeader(
  sessionId: string,
  userId: string,
  secret: string,
  maxAgeSeconds: number = 7 * 24 * 60 * 60 // 7 days
): Promise<string> {
  const value = await createSessionCookie(sessionId, userId, secret);
  // SameSite=Lax required for OAuth redirects (Google → our callback → device page)
  return `grove_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=.grove.place; Max-Age=${maxAgeSeconds}`;
}

/**
 * Generate cookie header to clear the session
 */
export function clearSessionCookieHeader(): string {
  return 'grove_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Domain=.grove.place; Max-Age=0';
}

/**
 * Generate device ID from request fingerprint
 * Uses HMAC of browser characteristics for consistent device identification
 */
export async function getDeviceId(request: Request, secret: string): Promise<string> {
  const components = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('cf-connecting-ip') || '',
  ];

  const hash = await hmacSign(components.join('|'), secret);
  return hash.substring(0, 16);
}

/**
 * Parse user agent into friendly device name
 */
export function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return 'Unknown Device';

  // Mobile devices
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) {
    if (userAgent.includes('Mobile')) return 'Android Phone';
    return 'Android Tablet';
  }

  // Desktop browsers
  if (userAgent.includes('Mac OS')) {
    if (userAgent.includes('Chrome')) return 'Chrome on Mac';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari on Mac';
    if (userAgent.includes('Firefox')) return 'Firefox on Mac';
    if (userAgent.includes('Arc')) return 'Arc on Mac';
    return 'Mac';
  }

  if (userAgent.includes('Windows')) {
    if (userAgent.includes('Edg/')) return 'Edge on Windows';
    if (userAgent.includes('Chrome')) return 'Chrome on Windows';
    if (userAgent.includes('Firefox')) return 'Firefox on Windows';
    return 'Windows PC';
  }

  if (userAgent.includes('Linux')) {
    if (userAgent.includes('Chrome')) return 'Chrome on Linux';
    if (userAgent.includes('Firefox')) return 'Firefox on Linux';
    return 'Linux';
  }

  if (userAgent.includes('CrOS')) return 'Chromebook';

  return 'Unknown Device';
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string | null {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || null;
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent');
}
