import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { Vendor } from '../models/vendor.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};
  // Removed company filter since we're removing company context

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { contactPerson: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];
  }

  const query = Vendor.find(filters).populate('createdBy', 'firstName lastName');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [vendors, total] = await Promise.all([query.exec(), Vendor.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, vendors, buildPaginationMeta(page, limit, total));
});

export const getVendor = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    throw ApiError.notFound('Vendor not found');
  }

  return respond(res, StatusCodes.OK, vendor);
});

export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { name, contactPerson, phone, email, address, creditReport } = req.body;

  const existing = await Vendor.findOne({ name });
  if (existing) {
    throw ApiError.conflict('Vendor with this name already exists');
  }

  const vendor = await Vendor.create({
    // Removed company field since we're removing company context
    name,
    contactPerson,
    phone,
    email,
    address,
    creditReport,
    createdBy: req.user?.id ? new Types.ObjectId(req.user.id) : undefined,
    status: 'pending'
  });

  return respond(res, StatusCodes.CREATED, vendor, { message: 'Vendor created successfully' });
});

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    throw ApiError.notFound('Vendor not found');
  }

  const { name, contactPerson, phone, email, address, creditReport, status } = req.body;

  if (name) vendor.name = name;
  if (contactPerson) vendor.contactPerson = contactPerson;
  if (phone) vendor.phone = phone;
  if (email) vendor.email = email;
  if (address) vendor.address = address;
  if (creditReport) vendor.creditReport = creditReport;
  if (status && ['pending', 'approved', 'inactive'].includes(status)) {
    vendor.status = status;
    if (status === 'approved' && req.user) {
      vendor.approvedBy = new Types.ObjectId(req.user.id);
      vendor.approvedAt = new Date();
    }
  }

  await vendor.save();

  return respond(res, StatusCodes.OK, vendor, { message: 'Vendor updated successfully' });
});

export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const vendor = await Vendor.findById(req.params.id);

  if (!vendor) {
    throw ApiError.notFound('Vendor not found');
  }

  await Vendor.deleteOne({ _id: vendor._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Vendor deleted successfully' });
});