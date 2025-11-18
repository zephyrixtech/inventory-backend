import type { Response } from 'express';

type Meta = Record<string, unknown>;

export const respond = <T>(res: Response, statusCode: number, data: T, meta?: Meta): Response => {
  return res.status(statusCode).json({
    data,
    meta
  });
};

