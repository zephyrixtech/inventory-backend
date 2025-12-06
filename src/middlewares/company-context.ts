import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';

import { Company } from '../models/company.model';
import { asyncHandler } from '../utils/async-handler';

let cachedCompanyId: Types.ObjectId | null = null;

/**
 * Attach a default company context to every request when auth is not used.
 *
 * - If `req.companyId` is already set by `authenticate`, this does nothing.
 * - Otherwise, it will:
 *   - Use `process.env.DEFAULT_COMPANY_ID` if provided and valid
 *   - Fallback to the first active company in the database
 *
 * This allows running the backend without auth while still satisfying
 * all controllers that expect `req.companyId`.
 */
export const attachDefaultCompany = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    // If auth middleware has already set companyId, respect it
    if (req.companyId) {
      return next();
    }

    // If we already resolved a default company, reuse it
    if (cachedCompanyId) {
      req.companyId = cachedCompanyId;
      return next();
    }

    // Prefer an explicit DEFAULT_COMPANY_ID if configured
    const fromEnv = process.env.DEFAULT_COMPANY_ID;
    if (fromEnv) {
      const companyFromEnv = await Company.findById(fromEnv).select('_id');
      if (companyFromEnv) {
        cachedCompanyId = companyFromEnv._id;
        req.companyId = cachedCompanyId;
        return next();
      }
    }

    // Fallback: pick the first active company
    const anyCompany = await Company.findOne({ isActive: true }).select('_id');
    if (anyCompany) {
      cachedCompanyId = anyCompany._id;
      req.companyId = cachedCompanyId;
    }

    // Even if no company exists yet, just continue – controllers will still
    // throw "Company context missing", which is accurate in that case.
    return next();
  }
);




