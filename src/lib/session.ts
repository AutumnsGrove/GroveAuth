/**
 * Session Utilities for SessionDO
 * Uses Web Crypto API for AES-GCM encryption + HMAC-SHA256 signing
 *
 * Cookie format: {iv}:{encryptedPayload}:{authTag}
 * - iv: 12-byte random initialization vector (base64url)
 * - encryptedPayload: AES-GCM encrypted {sessionId}:{userId} (base64url)
 * - authTag: included in AES-GCM output (authenticates the ciphertext)
 *
 * This prevents userId enumeration by encrypting the entire payload.
 */

export interface ParsedSessionCookie {
  sessionId: string;
  userId: string;
  signature: string; // Kept for backward compatibility, now represents the auth tag
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
 * Base64 URL decode
 */
function base64UrlDecode(str: string): Uint8Array {
  // Restore standard base64 characters
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive AES-GCM key from secret using HKDF
 * This creates a proper 256-bit key from any length secret
 */
async function getAesKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'HKDF',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('grove-session-v1'), // Fixed salt for deterministic key
      info: encoder.encode('session-cookie'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Import secret as HMAC key for crypto.subtle
 * Used for device fingerprinting
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
 * Used for device fingerprinting
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
 * Create an encrypted session cookie value
 * Format: {iv}:{encryptedPayload} (AES-GCM includes auth tag in ciphertext)
 *
 * The payload {sessionId}:{userId} is encrypted with AES-256-GCM, preventing
 * userId enumeration attacks. The IV ensures each cookie is unique even for
 * the same user/session.
 */
export async function createSessionCookie(
  sessionId: string,
  userId: string,
  secret: string
): Promise<string> {
  const key = await getAesKey(secret);
  const encoder = new TextEncoder();

  // Generate random 12-byte IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the payload
  const payload = `${sessionId}:${userId}`;
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(payload)
  );

  // Format: {iv}:{encryptedPayload} (auth tag is part of ciphertext in Web Crypto)
  return `${base64UrlEncode(iv)}:${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

/**
 * Parse and decrypt a session cookie
 * Returns null if invalid, tampered, or decryption fails
 *
 * AES-GCM provides authenticated encryption - if the cookie is tampered with,
 * decryption will fail with an error (not silently produce garbage).
 */
export async function parseSessionCookie(
  cookie: string,
  secret: string
): Promise<ParsedSessionCookie | null> {
  try {
    const parts = cookie.split(':');

    // New format: {iv}:{encryptedPayload}
    if (parts.length === 2) {
      const [ivStr, ciphertextStr] = parts;

      const key = await getAesKey(secret);
      const iv = base64UrlDecode(ivStr);
      const ciphertext = base64UrlDecode(ciphertextStr);

      // Decrypt (will throw if tampered - AES-GCM is authenticated)
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      const payload = decoder.decode(plaintext);
      const payloadParts = payload.split(':');

      if (payloadParts.length !== 2) {
        console.log('[Session] Invalid decrypted payload format');
        return null;
      }

      const [sessionId, userId] = payloadParts;
      return { sessionId, userId, signature: 'aes-gcm' };
    }

    // Legacy format: {sessionId}:{userId}:{signature} - for backward compatibility
    // This allows existing sessions to continue working during migration
    if (parts.length === 3) {
      const [sessionId, userId, providedSignature] = parts;

      // Verify signature using HMAC
      const legacyPayload = `${sessionId}:${userId}`;
      const expectedSignature = await hmacSign(legacyPayload, secret);

      if (!timingSafeEqual(providedSignature, expectedSignature)) {
        console.log('[Session] Invalid legacy cookie signature');
        return null;
      }

      return { sessionId, userId, signature: providedSignature };
    }

    console.log('[Session] Invalid cookie format');
    return null;
  } catch (error) {
    // AES-GCM throws on decryption failure (tampered cookie)
    console.log('[Session] Cookie decryption failed:', error instanceof Error ? error.message : 'unknown');
    return null;
  }
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
 *
 * Enhanced with Sec-CH-UA client hints for better entropy:
 * - Sec-CH-UA: Browser brand/version (e.g., "Chromium";v="120", "Google Chrome";v="120")
 * - Sec-CH-UA-Platform: OS (e.g., "macOS", "Windows", "Android")
 * - Sec-CH-UA-Mobile: Mobile indicator (?0 or ?1)
 *
 * This improves device identification accuracy while respecting privacy
 * (client hints are less fingerprintable than full User-Agent).
 */
export async function getDeviceId(request: Request, secret: string): Promise<string> {
  const components = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('cf-connecting-ip') || '',
    // Sec-CH-UA client hints (if available)
    request.headers.get('sec-ch-ua') || '',
    request.headers.get('sec-ch-ua-platform') || '',
    request.headers.get('sec-ch-ua-mobile') || '',
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
