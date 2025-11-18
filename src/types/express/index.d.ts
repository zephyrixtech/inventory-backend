import type { Types } from 'mongoose';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      company: string;
      role: string;
      permissions?: string[];
    };
    companyId?: Types.ObjectId;
  }
}

