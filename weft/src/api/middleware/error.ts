import type { Request, Response, NextFunction } from 'express';

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
  stack?: string;
}

/**
 * Custom API error class
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'APIError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handling middleware
 *
 * Catches all errors thrown in route handlers and converts them
 * to proper JSON error responses with appropriate status codes.
 *
 * Handles OpenAPI validation errors with detailed feedback.
 */
export function errorHandler(
  err: Error | APIError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log the error
  console.error('API Error:', err);

  // Handle OpenAPI validation errors
  if ('status' in err && err.status === 400 && 'errors' in err) {
    const validationError = err as {
      status: number;
      message: string;
      errors: Array<{
        path: string;
        message: string;
        errorCode?: string;
      }>;
    };

    const errorResponse: ErrorResponse = {
      error: 'ValidationError',
      message: validationError.message || 'Request validation failed',
      details: {
        validationErrors: validationError.errors.map((e) => ({
          field: e.path,
          message: e.message,
          code: e.errorCode,
        })),
      },
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Handle response validation errors (500 - this is an implementation bug)
  if ('status' in err && err.status === 500 && 'errors' in err) {
    const validationError = err as {
      status: number;
      message: string;
      errors: Array<{
        path: string;
        message: string;
      }>;
    };

    console.error('CRITICAL: Response validation failed!', validationError.errors);

    const errorResponse: ErrorResponse = {
      error: 'ResponseValidationError',
      message: 'Internal server error - response validation failed',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              responseErrors: validationError.errors,
            }
          : undefined,
    };

    res.status(500).json(errorResponse);
    return;
  }

  // Determine status code
  const statusCode = err instanceof APIError ? err.statusCode : 500;

  // Build error response
  const errorResponse: ErrorResponse = {
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
  };

  // Add details if available
  if (err instanceof APIError && err.details) {
    errorResponse.details = err.details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
  });
}
