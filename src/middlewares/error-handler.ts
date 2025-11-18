import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { logger } from '../utils/logger';
import { ApiError } from '../utils/api-error';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): Response => {
  if (error instanceof ApiError) {
    if (!error.isOperational) {
      logger.error({ error }, 'Unhandled operational error');
    }
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details ?? null
      }
    });
  }

  logger.error({ error }, 'Unhandled error');
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      message: 'Internal Server Error'
    }
  });
};

