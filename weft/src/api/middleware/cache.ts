import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

/**
 * Generate an ETag from response data
 * Uses MD5 hash of JSON-stringified data
 */
export function generateETag(data: any): string {
  const hash = createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `"${hash}"`;
}

/**
 * Cache middleware for HTTP responses
 *
 * Sets Cache-Control and ETag headers on responses.
 * Handles conditional requests (If-None-Match) and returns
 * 304 Not Modified when ETag matches.
 *
 * @param maxAge - Cache duration in seconds (default: 30)
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.get('/stats', cacheMiddleware(60), async (req, res) => {
 *   const stats = await getStats();
 *   res.json(stats); // ETag and Cache-Control headers added automatically
 * });
 * ```
 */
export function cacheMiddleware(maxAge: number = 30) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Save original json method
    const originalJson = res.json.bind(res);

    // Override json method to add caching headers
    res.json = function (data: any) {
      // Generate ETag from response data
      const etag = generateETag(data);

      // Set caching headers
      res.set('Cache-Control', `max-age=${maxAge}, must-revalidate`);
      res.set('ETag', etag);

      // Check If-None-Match header for conditional request
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        // ETag matches - send 304 Not Modified
        return res.status(304).end();
      }

      // ETag doesn't match or not present - send full response
      return originalJson(data);
    };

    next();
  };
}
