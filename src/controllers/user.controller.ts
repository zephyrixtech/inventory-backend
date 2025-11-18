import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import bcrypt from 'bcryptjs';

import { User, type UserDocument } from '../models/user.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';
import { config } from '../config/env';

const VALID_ROLES = ['superadmin', 'admin', 'purchaser', 'biller'] as const;

type ValidRole = (typeof VALID_ROLES)[number];

const sanitizeUser = (user: UserDocument) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  failedAttempts: user.failedAttempts,
  lastLoginAt: user.lastLoginAt
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { status, role, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {
    company: companyId
  };

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (role && role !== 'all') {
    filters.role = role;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];
  }

  const query = User.find(filters);

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [users, total] = await Promise.all([query.exec(), User.countDocuments(filters)]);

  return respond(
    res,
    StatusCodes.OK,
    users.map((user) => sanitizeUser(user)),
    buildPaginationMeta(page, limit, total)
  );
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const user = await User.findOne({ _id: req.params.id, company: companyId });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return respond(res, StatusCodes.OK, sanitizeUser(user));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { firstName, lastName, email, phone, role, status = 'active', password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('Email already in use');
  }

  // Validate role is one of the allowed values
  if (!VALID_ROLES.includes(role as ValidRole)) {
    throw ApiError.badRequest('Invalid role');
  }

  const passwordHash = await bcrypt.hash(password, config.password.saltRounds);

  const user = await User.create({
    company: req.companyId,
    firstName,
    lastName,
    email,
    phone,
    role,
    status,
    passwordHash,
    isActive: status === 'active'
  });

  return respond(res, StatusCodes.CREATED, sanitizeUser(user), { message: 'User created successfully' });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const user = await User.findOne({ _id: req.params.id, company: companyId });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const updates: Record<string, unknown> = {};
  const { firstName, lastName, phone, status, role, password, email, failedAttempts } = req.body;

  if (firstName) updates.firstName = firstName;
  if (lastName) updates.lastName = lastName;
  if (phone) updates.phone = phone;
  if (status) {
    updates.status = status;
    updates.isActive = status === 'active';
  }
  if (role) {
    if (!VALID_ROLES.includes(role as ValidRole)) {
      throw ApiError.badRequest('Invalid role');
    }
    updates.role = role;
  }
  if (email && email !== user.email) {
    const emailInUse = await User.findOne({ email, _id: { $ne: user._id } });
    if (emailInUse) {
      throw ApiError.conflict('Email already in use');
    }
    updates.email = email;
  }
  if (password) {
    updates.passwordHash = await bcrypt.hash(password, config.password.saltRounds);
  }
  if (typeof failedAttempts === 'number') {
    updates.failedAttempts = failedAttempts;
  }

  Object.assign(user, updates);
  await user.save();

  return respond(res, StatusCodes.OK, sanitizeUser(user), { message: 'User updated successfully' });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const user = await User.findOne({ _id: req.params.id, company: companyId });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  user.isActive = false;
  user.status = 'inactive';
  await user.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'User deactivated successfully' });
});

