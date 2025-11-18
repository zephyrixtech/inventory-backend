import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Supplier } from '../models/supplier.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { status, contact, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {
    company: companyId
  };

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (contact && typeof contact === 'string') {
    filters.contactPerson = contact;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { supplierId: new RegExp(search, 'i') },
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
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const supplier = await Supplier.findOne({ _id: req.params.id, company: companyId });

  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }

  return respond(res, StatusCodes.OK, supplier);
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { 
    supplierId, 
    name, 
    email, 
    phone, 
    contactPerson, 
    status, 
    address, 
    creditReport,
    registrationNumber,
    taxId,
    website,
    city,
    state,
    postalCode,
    country,
    bankName,
    bank_account_number,
    ifscCode,
    ibanCode,
    creditLimit,
    paymentTerms,
    description,
    rating,
    notes,
    selectedBrands,
    selectedSupplies
  } = req.body;

  const existing = await Supplier.findOne({ company: companyId, supplierId });
  if (existing) {
    throw ApiError.conflict('Supplier with this ID already exists');
  }

  const supplier = await Supplier.create({
    company: companyId,
    supplierId,
    name,
    email,
    phone,
    contactPerson,
    status,
    address,
    creditReport,
    registrationNumber,
    taxId,
    website,
    city,
    state,
    postalCode,
    country,
    bankName,
    bank_account_number,
    ifscCode,
    ibanCode,
    creditLimit,
    paymentTerms,
    description,
    rating,
    notes,
    selectedBrands,
    selectedSupplies,
    createdBy: req.user?.id
  });

  return respond(res, StatusCodes.CREATED, supplier, { message: 'Supplier created successfully' });
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const supplier = await Supplier.findOne({ _id: req.params.id, company: companyId });

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
    creditReport, 
    isActive,
    registrationNumber,
    taxId,
    website,
    city,
    state,
    postalCode,
    country,
    bankName,
    bank_account_number,
    ifscCode,
    ibanCode,
    creditLimit,
    paymentTerms,
    description,
    rating,
    notes,
    selectedBrands,
    selectedSupplies
  } = req.body;

  if (name !== undefined) supplier.name = name;
  if (email !== undefined) supplier.email = email;
  if (phone !== undefined) supplier.phone = phone;
  if (contactPerson !== undefined) supplier.contactPerson = contactPerson;
  if (status !== undefined) supplier.status = status;
  if (typeof isActive === 'boolean') supplier.isActive = isActive;
  if (address !== undefined) supplier.address = address;
  if (creditReport !== undefined) supplier.creditReport = creditReport;
  if (registrationNumber !== undefined) supplier.registrationNumber = registrationNumber;
  if (taxId !== undefined) supplier.taxId = taxId;
  if (website !== undefined) supplier.website = website;
  if (city !== undefined) supplier.city = city;
  if (state !== undefined) supplier.state = state;
  if (postalCode !== undefined) supplier.postalCode = postalCode;
  if (country !== undefined) supplier.country = country;
  if (bankName !== undefined) supplier.bankName = bankName;
  if (bank_account_number !== undefined) supplier.bank_account_number = bank_account_number;
  if (ifscCode !== undefined) supplier.ifscCode = ifscCode;
  if (ibanCode !== undefined) supplier.ibanCode = ibanCode;
  if (creditLimit !== undefined) supplier.creditLimit = creditLimit;
  if (paymentTerms !== undefined) supplier.paymentTerms = paymentTerms;
  if (description !== undefined) supplier.description = description;
  if (rating !== undefined) supplier.rating = rating;
  if (notes !== undefined) supplier.notes = notes;
  if (selectedBrands !== undefined) supplier.selectedBrands = selectedBrands;
  if (selectedSupplies !== undefined) supplier.selectedSupplies = selectedSupplies;

  await supplier.save();

  return respond(res, StatusCodes.OK, supplier, { message: 'Supplier updated successfully' });
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const supplier = await Supplier.findOne({ _id: req.params.id, company: companyId });

  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }

  supplier.isActive = false;
  supplier.status = 'rejected';
  await supplier.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Supplier deactivated successfully' });
});