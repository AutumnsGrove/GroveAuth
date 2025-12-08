/**
 * CORS Middleware - Cross-Origin Resource Sharing
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types.js';
import { getClientByClientId } from '../db/queries.js';

/**
 * Dynamic CORS middleware based on registered client origins
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin');

  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  await next();

  // Add CORS headers to response
  const corsHeaders = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    c.res.headers.set(key, value);
  }
};

/**
 * Get CORS headers for a given origin
 * In production, we validate against registered client origins
 */
function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (origin) {
    // For now, allow *.grove.place origins
    // In production, validate against client.allowed_origins
    if (origin.endsWith('.grove.place') || origin === 'https://autumnsgrove.place') {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  return headers;
}

/**
 * Validate origin against registered client
 */
export async function validateOriginForClient(
  db: D1Database,
  clientId: string,
  origin: string
): Promise<boolean> {
  const client = await getClientByClientId(db, clientId);
  if (!client) return false;

  const allowedOrigins: string[] = JSON.parse(client.allowed_origins);
  return allowedOrigins.includes(origin);
}
