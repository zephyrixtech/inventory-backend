import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';

import { Company } from '../models/company.model';
import { asyncHandler } from '../utils/async-handler';

/**
 * Dummy middleware that does nothing since we're removing company context.
 * This maintains backward compatibility with the app setup.
 */
export const attachDefaultCompany = asyncHandler(
  async (_req: Request, _res: Response, next: NextFunction) => {
    // Do nothing since we're removing company context
    return next();
  }
);




