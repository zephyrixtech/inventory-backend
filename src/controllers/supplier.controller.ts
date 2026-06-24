import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Supplier } from '../models/supplier.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';
import { logAudit } from '../utils/audit-logger';

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

  await logAudit(req, 'Supplier Management', 'Supplier View', supplier.name, `Viewed supplier "${supplier.name}".`);

  return respond(res, StatusCodes.OK, supplier);
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  try {
    console.log('=== CREATE SUPPLIER DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User context:', req.user ? { id: req.user.id, role: req.user.role } : 'No user');
    console.log('MongoDB connection state:', require('mongoose').connection.readyState);
    
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

    if (!name || name.trim() === '') {
      console.error('Validation failed: name is required');
      throw ApiError.badRequest('Company name is required');
    }

    const supplierData: any = {
      name: name.trim(),
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      contactPerson: contactPerson?.trim() || undefined,
      status: status || 'pending',
      address: address?.trim() || undefined,
      registrationNumber: registrationNumber?.trim() || undefined,
      website: website?.trim() || undefined,
      city: city?.trim() || undefined,
      state: state?.trim() || undefined,
      postalCode: postalCode?.trim() || undefined,
      country: country?.trim() || undefined,
      bankName: bankName?.trim() || undefined,
      bank_account_number: bank_account_number?.trim() || undefined,
      ifscCode: ifscCode?.trim() || undefined,
      ibanCode: ibanCode?.trim() || undefined,
      description: description?.trim() || undefined,
      rating: rating || undefined
    };

    // Only add createdBy if user exists
    if (req.user?.id) {
      supplierData.createdBy = req.user.id;
      console.log('Adding createdBy:', req.user.id);
    } else {
      console.log('No user context, skipping createdBy');
    }

    console.log('Creating supplier with data:', JSON.stringify(supplierData, null, 2));
    const supplier = await Supplier.create(supplierData);
    console.log('Supplier created successfully:', supplier._id);

    await logAudit(
      req,
      'Supplier Management',
      'Supplier Creation',
      supplier.name,
      `Created supplier "${supplier.name}".`
    );

    return respond(res, StatusCodes.CREATED, supplier, { message: 'Supplier created successfully' });
  } catch (error) {
    console.error('=== ERROR CREATING SUPPLIER ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    if (error && typeof error === 'object' && 'errors' in error) {
      console.error('Validation errors:', JSON.stringify((error as any).errors, null, 2));
    }
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

  const changedFields: string[] = [];
  if (name !== undefined && name !== supplier.name) {
    changedFields.push(`name: "${supplier.name}" -> "${name}"`);
    supplier.name = name;
  }
  if (email !== undefined && email !== supplier.email) {
    changedFields.push(`email: "${supplier.email || ''}" -> "${email}"`);
    supplier.email = email;
  }
  if (phone !== undefined && phone !== supplier.phone) {
    changedFields.push(`phone: "${supplier.phone || ''}" -> "${phone}"`);
    supplier.phone = phone;
  }
  if (contactPerson !== undefined && contactPerson !== supplier.contactPerson) {
    changedFields.push(`contactPerson: "${supplier.contactPerson || ''}" -> "${contactPerson}"`);
    supplier.contactPerson = contactPerson;
  }
  if (status !== undefined && status !== supplier.status) {
    changedFields.push(`status: "${supplier.status}" -> "${status}"`);
    supplier.status = status;
  }
  if (typeof isActive === 'boolean' && isActive !== supplier.isActive) {
    changedFields.push(`isActive: ${supplier.isActive} -> ${isActive}`);
    supplier.isActive = isActive;
  }
  if (address !== undefined && address !== supplier.address) {
    changedFields.push(`address: updated`);
    supplier.address = address;
  }
  if (registrationNumber !== undefined && registrationNumber !== supplier.registrationNumber) {
    changedFields.push(`registrationNumber: "${supplier.registrationNumber || ''}" -> "${registrationNumber}"`);
    supplier.registrationNumber = registrationNumber;
  }
  if (website !== undefined && website !== supplier.website) {
    changedFields.push(`website: "${supplier.website || ''}" -> "${website}"`);
    supplier.website = website;
  }
  if (city !== undefined && city !== supplier.city) {
    changedFields.push(`city: "${supplier.city || ''}" -> "${city}"`);
    supplier.city = city;
  }
  if (state !== undefined && state !== supplier.state) {
    changedFields.push(`state: "${supplier.state || ''}" -> "${state}"`);
    supplier.state = state;
  }
  if (postalCode !== undefined && postalCode !== supplier.postalCode) {
    changedFields.push(`postalCode: "${supplier.postalCode || ''}" -> "${postalCode}"`);
    supplier.postalCode = postalCode;
  }
  if (country !== undefined && country !== supplier.country) {
    changedFields.push(`country: "${supplier.country || ''}" -> "${country}"`);
    supplier.country = country;
  }
  if (bankName !== undefined && bankName !== supplier.bankName) {
    changedFields.push(`bankName: "${supplier.bankName || ''}" -> "${bankName}"`);
    supplier.bankName = bankName;
  }
  if (bank_account_number !== undefined && bank_account_number !== supplier.bank_account_number) {
    changedFields.push(`bank_account_number: "${supplier.bank_account_number || ''}" -> "${bank_account_number}"`);
    supplier.bank_account_number = bank_account_number;
  }
  if (ifscCode !== undefined && ifscCode !== supplier.ifscCode) {
    changedFields.push(`ifscCode: "${supplier.ifscCode || ''}" -> "${ifscCode}"`);
    supplier.ifscCode = ifscCode;
  }
  if (ibanCode !== undefined && ibanCode !== supplier.ibanCode) {
    changedFields.push(`ibanCode: "${supplier.ibanCode || ''}" -> "${ibanCode}"`);
    supplier.ibanCode = ibanCode;
  }
  if (description !== undefined && description !== supplier.description) {
    changedFields.push(`description: updated`);
    supplier.description = description;
  }
  if (rating !== undefined && rating !== supplier.rating) {
    changedFields.push(`rating: ${supplier.rating || 0} -> ${rating}`);
    supplier.rating = rating;
  }

  await supplier.save();

  if (changedFields.length > 0) {
    await logAudit(
      req,
      'Supplier Management',
      'Supplier Update',
      supplier.name,
      `Updated supplier "${supplier.name}": ${changedFields.join(', ')}.`
    );
  }

  return respond(res, StatusCodes.OK, supplier, { message: 'Supplier updated successfully' });
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }

  await Supplier.deleteOne({ _id: supplier._id });

  await logAudit(
    req,
    'Supplier Management',
    'Supplier Deletion',
    supplier.name,
    `Deleted supplier "${supplier.name}".`
  );

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Supplier deleted successfully' });
});