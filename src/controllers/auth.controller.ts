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
console.log(req.body, "body")

  const user = await User.findOne({ email }).populate('role');

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

  let roleInfo = 'biller';
  if (typeof user.role === 'string') {
    roleInfo = user.role;
  } else if (user.role && typeof user.role === 'object') {
    roleInfo = (user.role as any).name || 'biller';
  }

  const payload = buildTokenPayload({
    userId: user._id,
    companyId: user.company,
    roleId: typeof user.role === 'string' ? user.role : (user.role as any)._id ?? user.role,
    permissions: (user.role as any)?.permissions
  });

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await RefreshToken.create({
    user: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  const company = await Company.findById(user.company).lean();

  return respond(res, StatusCodes.OK, {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: roleInfo, 
      permissions: (user.role as any)?.permissions ?? [],
      companyId: user.company.toString(),
      company: company
        ? {
            id: company._id,
            name: company.name,
            code: company.code,
            currency: company.currency
          }
        : null,
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

    const user = await User.findById(payload.sub).populate('role');
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    let roleInfo = 'biller'; // default fallback
    if (typeof user.role === 'string') {
      roleInfo = user.role;
    } else if (user.role && typeof user.role === 'object') {
      roleInfo = (user.role as any).name || 'biller';
    }

    const newPayload = buildTokenPayload({
      userId: user._id,
      companyId: user.company,
      roleId: typeof user.role === 'string' ? user.role : (user.role as any)._id ?? user.role,
      permissions: (user.role as any)?.permissions
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

  const user = await User.findById(req.user.id)
    .populate('role', 'name permissions')
    .populate('company', 'name code currency');

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  let roleInfo = 'biller'; 
  if (typeof user.role === 'string') {
    roleInfo = user.role;
  } else if (user.role && typeof user.role === 'object') {
    roleInfo = (user.role as any).name || 'biller';
  }

  return respond(res, StatusCodes.OK, {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: roleInfo, // Send the processed role name
    companyId: user.company._id,
    company: user.company,
    permissions: (user.role as any)?.permissions ?? []
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

