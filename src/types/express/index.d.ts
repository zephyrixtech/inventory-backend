import type { Types } from 'mongoose';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      // Removed company field since we're removing company context
      role: string;
      permissions?: string[];
    };
    // Removed companyId property since we're removing company context
  }
}