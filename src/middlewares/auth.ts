import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';

import { User } from '../models/user.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import { verifyAccessToken } from '../services/token.service';

const ROLE_PERMISSION_FALLBACK: Record<string, string[]> = {
  superadmin: ['*'],
  admin: ['manage_users'],
  purchaser: [],
  biller: []
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

    const user = await User.findById(payload.sub).populate('role', 'permissions company');

    if (!user || !user.isActive || user.status !== 'active') {
      throw ApiError.unauthorized('User is not active');
    }

    const populatedRole = user.role as unknown as { _id?: Types.ObjectId; permissions?: string[]; name?: string };

    let resolvedRoleId: string;
    if (typeof user.role === 'string' && user.role.length > 0) {
      resolvedRoleId = user.role;
    } else if (populatedRole?._id) {
      resolvedRoleId = populatedRole._id.toString();
    } else if (typeof payload.role === 'string') {
      resolvedRoleId = payload.role;
    } else {
      resolvedRoleId = '';
    }

    const resolvedPermissions =
      populatedRole?.permissions ??
      payload.permissions ??
      (typeof user.role === 'string' ? ROLE_PERMISSION_FALLBACK[user.role] : undefined) ??
      (populatedRole?.name ? ROLE_PERMISSION_FALLBACK[populatedRole.name] : []) ??
      [];

    req.user = {
      id: user._id.toString(),
      company: user.company.toString(),
      role: resolvedRoleId,
      permissions: resolvedPermissions
    };
    req.companyId = user.company;

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

