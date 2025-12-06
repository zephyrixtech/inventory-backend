import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcryptjs';

import { Company } from '../models/company.model';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { RefreshToken } from '../models/token.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { buildTokenPayload, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../services/token.service';
import { config } from '../config/env';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { companyName, companyCode, currency, firstName, lastName, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('A user with this email already exists');
  }

  const existingCompany = await Company.findOne({ code: companyCode });
  if (existingCompany) {
    throw ApiError.conflict('A company with this code already exists');
  }

  const company = await Company.create({
    name: companyName,
    code: companyCode,
    currency
  });

  const role = await Role.create({
    name: 'Super Admin',
    company: company._id,
    permissions: ['*'],
    isActive: true
  });

  const passwordHash = await bcrypt.hash(password, config.password.saltRounds);

  const user = await User.create({
    company: company._id,
    firstName,
    lastName,
    email,
    passwordHash,
    role: role._id,
    status: 'active'
  });

  const payload = buildTokenPayload({
    userId: user._id,
    companyId: company._id,
    roleId: role._id,
    permissions: role.permissions
  });

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await RefreshToken.create({
    user: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return respond(
    res,
    StatusCodes.CREATED,
    {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: role.name,
        permissions: role.permissions ?? [],
        companyId: company._id,
        company: {
          id: company._id,
          name: company.name,
          code: company.code,
          currency: company.currency
        },
        status: user.status,
        isActive: user.isActive
      }
    },
    { message: 'Registration successful' }
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  console.log(req.body, "body");

  const user = await User.findOne({ email });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Check if user is locked and unlock if credentials are correct
  const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
  
  if (user.status === 'locked' && isPasswordMatch) {
    // Unlock the account if password is correct
    user.status = 'active';
    user.failedAttempts = 0;
    await user.save();
  }

  if (!user || !user.isActive || (user.status !== 'active' && !(user.status === 'locked' && isPasswordMatch))) {
    // Only increment failed attempts if user is not already locked
    if (user.status !== 'locked') {
      user.failedAttempts += 1;
      if (user.failedAttempts >= 5) {
        user.status = 'locked';
      }
      await user.save();
    }
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!isPasswordMatch) {
    user.failedAttempts += 1;
    if (user.failedAttempts >= 5) {
      user.status = 'locked';
    }
    await user.save();
    throw ApiError.unauthorized('Invalid email or password');
  }

  user.failedAttempts = 0;
  user.lastLoginAt = new Date();
  await user.save();

  // Handle role properly based on the user model definition
  const roleInfo = user.role || 'biller';

  // Get role permissions if needed (for superadmin role, we might want to give all permissions)
  let permissions: string[] = [];
  if (user.role === 'superadmin') {
    // Super admin gets all permissions
    permissions = ['*'];
  } else {
    // For other roles, we would need to fetch permissions from the role model
    // But since the user.role is a string, not a reference, we'll leave it empty for now
    permissions = [];
  }

  const payload = buildTokenPayload({
    userId: user._id,
    companyId: user._id, // Using user._id as companyId since we're removing company context
    roleId: user._id, // Using user._id as roleId since role is a string, not a reference
    permissions: permissions
  });

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await RefreshToken.create({
    user: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  // Get company info (using user._id as companyId since we're removing company context)
  const company = {
    id: user._id,
    name: 'Default Company',
    code: 'DEFAULT',
    currency: 'USD'
  };

  return respond(res, StatusCodes.OK, {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: roleInfo, 
      permissions: permissions,
      company: company,
      status: user.status,
      isActive: user.isActive
    }
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw ApiError.badRequest('Refresh token is required');
  }

  const storedToken = await RefreshToken.findOne({ token: refreshToken });

  if (!storedToken) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    const user = await User.findById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Handle role properly based on the user model definition
    const roleInfo = user.role || 'biller';

    // Get role permissions if needed
    let permissions: string[] = [];
    if (user.role === 'superadmin') {
      // Super admin gets all permissions
      permissions = ['*'];
    } else {
      // For other roles, permissions would be fetched differently
      permissions = [];
    }

    const newPayload = buildTokenPayload({
      userId: user._id,
      companyId: user._id, // Using user._id as companyId since we're removing company context
      roleId: user._id, // Using user._id as roleId since role is a string, not a reference
      permissions: permissions
    });

    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    storedToken.token = newRefreshToken;
    storedToken.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storedToken.save();

    return respond(res, StatusCodes.OK, {
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    await storedToken.deleteOne();
    throw ApiError.unauthorized('Invalid refresh token');
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Unauthorized');
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Handle role properly based on the user model definition
  const roleInfo = user.role || 'biller';

  // Get role permissions if needed
  let permissions: string[] = [];
  if (user.role === 'superadmin') {
    // Super admin gets all permissions
    permissions = ['*'];
  } else {
    // For other roles, permissions would be fetched differently
    permissions = [];
  }

  // Get company info (using user._id as companyId since we're removing company context)
  const company = {
    id: user._id,
    name: 'Default Company',
    code: 'DEFAULT',
    currency: 'USD'
  };

  return respond(res, StatusCodes.OK, {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: roleInfo,
    company: company,
    permissions: permissions
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Unauthorized');
  }

  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isPasswordMatch = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isPasswordMatch) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  user.passwordHash = await bcrypt.hash(newPassword, config.password.saltRounds);
  await user.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Password updated successfully' });
});

