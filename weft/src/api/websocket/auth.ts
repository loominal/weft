/**
 * WebSocket Authentication
 *
 * Provides bearer token authentication for WebSocket connections
 * using query parameters or Sec-WebSocket-Protocol header
 */

import type { IncomingMessage } from 'http';
import { parse } from 'url';

/**
 * Authentication result
 */
export interface AuthResult {
  authenticated: boolean;
  error?: string;
}

/**
 * Authenticate a WebSocket connection
 *
 * Supports two authentication methods:
 * 1. Query parameter: ?token=secret-token
 * 2. Sec-WebSocket-Protocol header: "bearer, <token>"
 *
 * @param request - Incoming HTTP upgrade request
 * @param allowedTokens - Array of valid bearer tokens
 * @returns Authentication result with error details if authentication fails
 */
export function authenticateWebSocket(
  request: IncomingMessage,
  allowedTokens: string[]
): AuthResult {
  // If no tokens configured, auth is disabled
  if (!allowedTokens || allowedTokens.length === 0) {
    return { authenticated: true };
  }

  // Try query parameter first
  const { query } = parse(request.url || '', true);
  if (query.token) {
    const token = Array.isArray(query.token) ? query.token[0] : query.token;
    if (token && allowedTokens.includes(token)) {
      return { authenticated: true };
    }
    return { authenticated: false, error: 'Invalid token' };
  }

  // Try Sec-WebSocket-Protocol header
  const protocols = request.headers['sec-websocket-protocol'];
  if (protocols) {
    const protocolList = protocols.split(',').map(p => p.trim());

    // Format: ["bearer", "token-value"]
    const bearerIndex = protocolList.indexOf('bearer');
    if (bearerIndex !== -1 && protocolList[bearerIndex + 1]) {
      const token = protocolList[bearerIndex + 1];
      if (token && allowedTokens.includes(token)) {
        return { authenticated: true };
      }
      return { authenticated: false, error: 'Invalid token' };
    }
  }

  return { authenticated: false, error: 'No token provided' };
}
