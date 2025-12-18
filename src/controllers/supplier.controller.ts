import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Supplier } from '../models/supplier.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const { status, contact, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (contact && typeof contact === 'string') {
    filters.contactPerson = contact;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];
  }

  const query = Supplier.find(filters).populate('createdBy', 'firstName lastName email');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [suppliers, total] = await Promise.all([query.exec(), Supplier.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, suppliers, buildPaginationMeta(page, limit, total));
});

export const getSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }

  return respond(res, StatusCodes.OK, supplier);
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      contactPerson, 
      status, 
      address, 
      registrationNumber,
      website,
      city,
      state,
      postalCode,
      country,
      bankName,
      bank_account_number,
      ifscCode,
      ibanCode,
      description,
      rating
    } = req.body;

  const supplierData: any = {
    name,
    email,
    phone,
    contactPerson,
    status: status || 'pending',
    address,
    registrationNumber,
    website,
    city,
    state,
    postalCode,
    country,
    bankName,
    bank_account_number,
    ifscCode,
    ibanCode,
    description,
    rating
  };

  // Only add createdBy if user exists
  if (req.user?.id) {
    supplierData.createdBy = req.user.id;
  }

    const supplier = await Supplier.create(supplierData);

    return respond(res, StatusCodes.CREATED, supplier, { message: 'Supplier created successfully' });
  } catch (error) {
    console.error('Error creating supplier:', error);
    throw error;
  }
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }

  const { 
    name, 
    email, 
    phone, 
    contactPerson, 
    status, 
    address, 
    isActive,
    registrationNumber,
    website,
    city,
    state,
    postalCode,
    country,
    bankName,
    bank_account_number,
    ifscCode,
    ibanCode,
    description,
    rating
  } = req.body;

  if (name !== undefined) supplier.name = name;
  if (email !== undefined) supplier.email = email;
  if (phone !== undefined) supplier.phone = phone;
  if (contactPerson !== undefined) supplier.contactPerson = contactPerson;
  if (status !== undefined) supplier.status = status;
  if (typeof isActive === 'boolean') supplier.isActive = isActive;
  if (address !== undefined) supplier.address = address;
  if (registrationNumber !== undefined) supplier.registrationNumber = registrationNumber;
  if (website !== undefined) supplier.website = website;
  if (city !== undefined) supplier.city = city;
  if (state !== undefined) supplier.state = state;
  if (postalCode !== undefined) supplier.postalCode = postalCode;
  if (country !== undefined) supplier.country = country;
  if (bankName !== undefined) supplier.bankName = bankName;
  if (bank_account_number !== undefined) supplier.bank_account_number = bank_account_number;
  if (ifscCode !== undefined) supplier.ifscCode = ifscCode;
  if (ibanCode !== undefined) supplier.ibanCode = ibanCode;
  if (description !== undefined) supplier.description = description;
  if (rating !== undefined) supplier.rating = rating;

  await supplier.save();

  return respond(res, StatusCodes.OK, supplier, { message: 'Supplier updated successfully' });
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }

  await Supplier.deleteOne({ _id: supplier._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Supplier deleted successfully' });
});