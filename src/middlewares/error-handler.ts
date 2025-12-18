import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { logger } from '../utils/logger';
import { ApiError } from '../utils/api-error';

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): Response => {
  if (error instanceof ApiError) {
    if (!error.isOperational) {
      logger.error({ error, path: req.path, method: req.method }, 'Unhandled operational error');
    }
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details ?? null
      }
    });
  }

  // Log detailed error information for debugging
  const errorDetails = {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    path: req.path,
    method: req.method,
    body: req.body,
    error: error
  };
  
  logger.error(errorDetails, 'Unhandled error');
  
  // In development, return more details
  if (process.env.NODE_ENV !== 'production') {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal Server Error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      message: 'Internal Server Error'
    }
  });
};

