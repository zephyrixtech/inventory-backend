import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Role } from '../models/role.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const listRoles = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const includeHidden = req.query.includeHidden === 'true';

  const roles = await Role.find({ company: companyId, isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  const payload = includeHidden ? roles : roles.filter((role) => role.name !== 'Super Admin');

  return respond(res, StatusCodes.OK, payload);
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, permissions = [] } = req.body;

  const existingRole = await Role.findOne({ company: req.companyId, name });
  if (existingRole) {
    throw ApiError.conflict('Role with this name already exists');
  }

  const role = await Role.create({
    name,
    description,
    permissions,
    company: req.companyId
  });

  return respond(res, StatusCodes.CREATED, role, { message: 'Role created successfully' });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, permissions, isActive } = req.body;

  const role = await Role.findOne({ _id: req.params.id, company: req.companyId });
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
  const role = await Role.findOne({ _id: req.params.id, company: req.companyId });
  if (!role) {
    throw ApiError.notFound('Role not found');
  }

  role.isActive = false;
  await role.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Role deactivated successfully' });
});

