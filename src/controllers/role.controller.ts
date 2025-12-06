import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Role } from '../models/role.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const listRoles = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const includeHidden = req.query.includeHidden === 'true';

  // Removed company filter since we're removing company context
  const roles = await Role.find({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  const payload = includeHidden ? roles : roles.filter((role) => role.name !== 'Super Admin');

  return respond(res, StatusCodes.OK, payload);
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, permissions = [] } = req.body;

  // Removed company filter since we're removing company context
  const existingRole = await Role.findOne({ name });
  if (existingRole) {
    throw ApiError.conflict('Role with this name already exists');
  }

  const role = await Role.create({
    name,
    description,
    permissions
    // Removed company field since we're removing company context
  });

  return respond(res, StatusCodes.CREATED, role, { message: 'Role created successfully' });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, permissions, isActive } = req.body;

  // Removed company filter since we're removing company context
  const role = await Role.findById(req.params.id);
  if (!role) {
    throw ApiError.notFound('Role not found');
  }

  if (name) role.name = name;
  if (description) role.description = description;
  if (permissions) role.permissions = permissions;
  if (typeof isActive === 'boolean') role.isActive = isActive;

  await role.save();

  return respond(res, StatusCodes.OK, role, { message: 'Role updated successfully' });
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  // Removed company filter since we're removing company context
  const role = await Role.findById(req.params.id);
  if (!role) {
    throw ApiError.notFound('Role not found');
  }

  role.isActive = false;
  await role.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Role deactivated successfully' });
});