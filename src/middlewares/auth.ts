import type { NextFunction, Request, Response } from 'express';

import { User } from '../models/user.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import { verifyAccessToken } from '../services/token.service';

const ROLE_PERMISSION_FALLBACK: Record<string, string[]> = {
  superadmin: ['*'],
  admin: ['*'],
  purchaser: ['manage_purchases', 'manage_inventory', 'manage_packing', 'manage_qc', 'manage_suppliers', 'manage_expenses'],
  biller: ['manage_sales', 'manage_inventory', 'manage_expenses', 'manage_suppliers']
};

const parseAuthHeader = (authorization?: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = parseAuthHeader(req.headers.authorization);

  if (!token) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  try {
    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.sub);

    if (!user || !user.isActive || user.status !== 'active') {
      throw ApiError.unauthorized('User is not active');
    }

    // Since role is stored as a string in the User model, use it directly
    const userRole = user.role;
    const resolvedPermissions = ROLE_PERMISSION_FALLBACK[userRole] || [];

    // Debug logging for biller role
    if (userRole === 'biller') {
      logger.info({
        userId: user._id.toString(),
        userRole,
        resolvedPermissions,
        fallbackPermissions: ROLE_PERMISSION_FALLBACK[userRole]
      }, 'Biller authentication debug');
    }

    req.user = {
      id: user._id.toString(),
      // Removed company field since we're removing company context
      role: userRole,
      permissions: resolvedPermissions
    };
    // Removed companyId assignment since we're removing company context
    
    next();
  } catch (error) {
    logger.warn({ error }, 'Failed to authenticate request');
    throw ApiError.unauthorized('Invalid or expired token');
  }
});

export const authorize =
  (requiredPermissions: string[] = []) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Unauthorized');
    }

    const userPermissions = new Set(req.user.permissions ?? []);
    if (userPermissions.has('*')) {
      return next();
    }
    const hasPermission = requiredPermissions.every((permission) => userPermissions.has(permission));

    if (!hasPermission) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }

    next();
  };