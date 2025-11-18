import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const notFoundHandler = (req: Request, res: Response): Response => {
  return res.status(StatusCodes.NOT_FOUND).json({
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
};

