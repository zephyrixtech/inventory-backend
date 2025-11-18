import type { NextFunction, Request, Response } from 'express';

type Handler<T extends Request = Request> = (req: T, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  <T extends Request>(handler: Handler<T>) =>
  async (req: T, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };

