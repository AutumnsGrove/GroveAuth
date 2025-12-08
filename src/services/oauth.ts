/**
 * OAuth Service - OAuth provider helpers
 */

import type {
  Env,
  GoogleTokenResponse,
  GoogleUserInfo,
  GitHubTokenResponse,
  GitHubUserInfo,
  GitHubEmail,
} from '../types.js';
import {
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  GOOGLE_SCOPES,
  GITHUB_AUTH_URL,
  GITHUB_TOKEN_URL,
  GITHUB_USERINFO_URL,
  GITHUB_EMAILS_URL,
  GITHUB_SCOPES,
} from '../utils/constants.js';

// ==================== Google OAuth ====================

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(
  env: Env,
  state: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    state: state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange Google authorization code for tokens
 */
export async function exchangeGoogleCode(
  env: Env,
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse | null> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      console.error('Google token exchange failed:', await response.text());
      return null;
    }

    return (await response.json()) as GoogleTokenResponse;
  } catch (error) {
    console.error('Google token exchange error:', error);
    return null;
  }
}

/**
 * Get Google user info using access token
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Google userinfo failed:', await response.text());
      return null;
    }

    return (await response.json()) as GoogleUserInfo;
  } catch (error) {
    console.error('Google userinfo error:', error);
    return null;
  }
}

// ==================== GitHub OAuth ====================

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthUrl(
  env: Env,
  state: string,
  _redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    scope: GITHUB_SCOPES.join(' '),
    state: state,
    allow_signup: 'false', // We don't allow public signup
  });

  return `${GITHUB_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange GitHub authorization code for access token
 */
export async function exchangeGitHubCode(
  env: Env,
  code: string
): Promise<GitHubTokenResponse | null> {
  try {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    if (!response.ok) {
      console.error('GitHub token exchange failed:', await response.text());
      return null;
    }

    const data = (await response.json()) as GitHubTokenResponse & { error?: string };

    if (data.error) {
      console.error('GitHub token exchange error:', data.error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('GitHub token exchange error:', error);
    return null;
  }
}

/**
 * Get GitHub user info using access token
 */
export async function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo | null> {
  try {
    const response = await fetch(GITHUB_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GroveAuth',
      },
    });

    if (!response.ok) {
      console.error('GitHub userinfo failed:', await response.text());
      return null;
    }

    return (await response.json()) as GitHubUserInfo;
  } catch (error) {
    console.error('GitHub userinfo error:', error);
    return null;
  }
}

/**
 * Get GitHub user's primary email
 */
export async function getGitHubPrimaryEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(GITHUB_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GroveAuth',
      },
    });

    if (!response.ok) {
      console.error('GitHub emails failed:', await response.text());
      return null;
    }

    const emails = (await response.json()) as GitHubEmail[];

    // Find primary verified email
    const primary = emails.find((e) => e.primary && e.verified);
    if (primary) return primary.email;

    // Fall back to any verified email
    const verified = emails.find((e) => e.verified);
    if (verified) return verified.email;

    return null;
  } catch (error) {
    console.error('GitHub emails error:', error);
    return null;
  }
}
