import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

/**
 * Validates request body against a Zod schema
 */
export const validateBody = (schema: ZodSchema) => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.body);
    
    if (!result.success) {
      const error = formatZodError(result.error);
      next(new AppError(error.message, 400));
      return;
    }
    
    request.body = result.data;
    next();
  };
};

/**
 * Validates request params against a Zod schema
 */
export const validateParams = (schema: ZodSchema) => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.params);
    
    if (!result.success) {
      const error = formatZodError(result.error);
      next(new AppError(error.message, 400));
      return;
    }
    
    request.params = result.data;
    next();
  };
};

/**
 * Validates request query against a Zod schema
 */
export const validateQuery = (schema: ZodSchema) => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.query);
    
    if (!result.success) {
      const error = formatZodError(result.error);
      next(new AppError(error.message, 400));
      return;
    }
    
    request.query = result.data;
    next();
  };
};

/**
 * Formats Zod validation errors into readable messages
 */
const formatZodError = (error: ZodError): { message: string; details: Record<string, string[]> } => {
  const formatted: Record<string, string[]> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.') || 'general';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });

  const message = Object.entries(formatted)
    .map(([path, messages]) => `${path}: ${messages.join(', ')}`)
    .join('; ');

  return { message, details: formatted };
};
