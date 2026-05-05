import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errors.js';

/**
 * Global error handler middleware
 * Catches all errors and returns consistent JSON responses
 */
export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  // Handle known application errors
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'TokenExpiredError') {
    response.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
    return;
  }

  if (error.name === 'JsonWebTokenError') {
    response.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  // Handle MongoDB duplicate key errors
  if ((error as any).name === 'MongoServerError' && (error as any).code === 11000) {
    const field = Object.keys((error as any).keyValue)[0];
    response.status(409).json({
      success: false,
      error: `${field} already exists`,
    });
    return;
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values((error as any).errors).map((err: any) => err.message);
    response.status(400).json({
      success: false,
      error: 'Validation failed',
      details: messages,
    });
    return;
  }

  // Handle cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    response.status(400).json({
      success: false,
      error: `Invalid ${(error as any).path}: ${(error as any).value}`,
    });
    return;
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  // Return generic error for unhandled cases
  response.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

/**
 * Async handler wrapper
 * Automatically catches errors in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(fn(request, response, next)).catch(next);
  };
};

/**
 * Not found handler
 * Returns 404 for unmatched routes
 */
export const notFoundHandler = (request: Request, response: Response): void => {
  response.status(404).json({
    success: false,
    error: `Not found - ${request.method} ${request.path}`,
  });
};
