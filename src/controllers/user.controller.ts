import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { User, type UserDocument } from '../models/user.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { config } from '../config/env';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';
import { logAudit } from '../utils/audit-logger';

type ValidRole = 'superadmin' | 'admin' | 'purchaser' | 'biller';
const VALID_ROLES: ValidRole[] = ['superadmin', 'admin', 'purchaser', 'biller'];

const sanitizeUser = (user: UserDocument) => ({
  id: user._id.toString(),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  isActive: user.isActive,
  avatarUrl: user.avatarUrl,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  
  const { status, role, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};
  // Removed company filter since we're removing company context

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

  return respond(res, StatusCodes.OK, users.map((user) => sanitizeUser(user)), buildPaginationMeta(page, limit, total));
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const user = await User.findById(req.params.id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return respond(res, StatusCodes.OK, sanitizeUser(user));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

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
    // Removed company field since we're removing company context
    firstName,
    lastName,
    email,
    phone,
    role,
    status,
    passwordHash,
    isActive: status === 'active'
  });

  await logAudit(
    req,
    'User Management',
    'User Creation',
    user.email,
    `User "${user.firstName} ${user.lastName}" (Role: ${user.role}) was created.`
  );

  return respond(res, StatusCodes.CREATED, sanitizeUser(user), { message: 'User created successfully' });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const user = await User.findById(req.params.id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const updates: Record<string, unknown> = {};
  const { firstName, lastName, phone, status, role, password, email, failedAttempts } = req.body;

  const changedFields: string[] = [];
  if (firstName && firstName !== user.firstName) {
    changedFields.push(`firstName: "${user.firstName}" -> "${firstName}"`);
    updates.firstName = firstName;
  }
  if (lastName && lastName !== user.lastName) {
    changedFields.push(`lastName: "${user.lastName}" -> "${lastName}"`);
    updates.lastName = lastName;
  }
  if (phone && phone !== user.phone) {
    changedFields.push(`phone: "${user.phone}" -> "${phone}"`);
    updates.phone = phone;
  }
  if (status && status !== user.status) {
    changedFields.push(`status: "${user.status}" -> "${status}"`);
    updates.status = status;
    updates.isActive = status === 'active';
  }
  if (role && role !== user.role) {
    if (!VALID_ROLES.includes(role as ValidRole)) {
      throw ApiError.badRequest('Invalid role');
    }
    changedFields.push(`role: "${user.role}" -> "${role}"`);
    updates.role = role;
  }
  if (email && email !== user.email) {
    const emailInUse = await User.findOne({ email, _id: { $ne: user._id } });
    if (emailInUse) {
      throw ApiError.conflict('Email already in use');
    }
    changedFields.push(`email: "${user.email}" -> "${email}"`);
    updates.email = email;
  }
  if (password) {
    changedFields.push('password was changed');
    updates.passwordHash = await bcrypt.hash(password, config.password.saltRounds);
  }
  if (typeof failedAttempts === 'number' && failedAttempts !== user.failedAttempts) {
    changedFields.push(`failedAttempts: ${user.failedAttempts} -> ${failedAttempts}`);
    updates.failedAttempts = failedAttempts;
  }

  Object.assign(user, updates);
  await user.save();

  if (changedFields.length > 0) {
    await logAudit(
      req,
      'User Management',
      'User Update',
      user.email,
      `User "${user.firstName} ${user.lastName}" was updated: ${changedFields.join(', ')}.`
    );
  }

  return respond(res, StatusCodes.OK, sanitizeUser(user), { message: 'User updated successfully' });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const user = await User.findById(req.params.id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  user.isActive = false;
  user.status = 'inactive';
  await user.save();

  await logAudit(
    req,
    'User Management',
    'User Deactivation',
    user.email,
    `User "${user.firstName} ${user.lastName}" was deactivated.`
  );

  return respond(res, StatusCodes.OK, { success: true }, { message: 'User deactivated successfully' });
});