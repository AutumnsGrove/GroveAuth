/**
 * GroveAuth Type Definitions
 */

// Environment bindings for Cloudflare Workers
export interface Env {
  // D1 Database
  DB: D1Database;

  // Environment variables
  AUTH_BASE_URL: string;
  ENVIRONMENT: string;

  // Secrets (set via wrangler secret put)
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
}

// Database Models
export interface Client {
  id: string;
  name: string;
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string; // JSON array
  allowed_origins: string; // JSON array
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: AuthProvider;
  provider_id: string | null;
  created_at: string;
  last_login: string | null;
}

export interface AllowedEmail {
  email: string;
  added_at: string;
  added_by: string | null;
}

export interface AuthCode {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string | null;
  code_challenge_method: string | null;
  expires_at: string;
  used: number;
  created_at: string;
}

export interface RefreshToken {
  id: string;
  token_hash: string;
  user_id: string;
  client_id: string;
  expires_at: string;
  revoked: number;
  created_at: string;
}

export interface MagicCode {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export interface RateLimit {
  key: string;
  count: number;
  window_start: string;
}

export interface FailedAttempt {
  email: string;
  attempts: number;
  last_attempt: string | null;
  locked_until: string | null;
}

export interface AuditLog {
  id: string;
  event_type: AuditEventType;
  user_id: string | null;
  client_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null; // JSON
  created_at: string;
}

// Enums
export type AuthProvider = 'google' | 'github' | 'magic_code';

export type AuditEventType =
  | 'login'
  | 'logout'
  | 'failed_login'
  | 'token_exchange'
  | 'token_refresh'
  | 'token_revoke'
  | 'magic_code_sent'
  | 'magic_code_verified';

// API Request/Response Types
export interface LoginParams {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge?: string;
  code_challenge_method?: 'S256';
}

export interface TokenRequest {
  grant_type: 'authorization_code' | 'refresh_token';
  code?: string;
  redirect_uri?: string;
  client_id: string;
  client_secret: string;
  code_verifier?: string;
  refresh_token?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface TokenInfo {
  active: boolean;
  sub?: string;
  email?: string;
  name?: string;
  exp?: number;
  iat?: number;
  client_id?: string;
}

export interface UserInfo {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: AuthProvider;
}

export interface MagicCodeSendRequest {
  email: string;
  client_id: string;
  redirect_uri: string;
}

export interface MagicCodeVerifyRequest {
  email: string;
  code: string;
  client_id: string;
  redirect_uri: string;
  state: string;
}

// OAuth Provider Types
export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUserInfo {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

// JWT Payload
export interface JWTPayload {
  sub: string;
  email: string;
  name: string | null;
  client_id: string;
  iss: string;
  iat: number;
  exp: number;
}

// Session state stored during OAuth flow
export interface OAuthState {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

// Error types
export interface AuthError {
  error: string;
  error_description?: string;
}
