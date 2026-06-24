import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Store, type StoreDocument } from '../models/store.model';
import { User, type UserDocument } from '../models/user.model';
import { Inventory } from '../models/inventory.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { logAudit } from '../utils/audit-logger';

export const createStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { name, code, managerId, phone, email, address, city, state, postalCode, country, bankName, bankAccountNumber, ifscCode, ibanCode, taxCode } = req.body;

  const existing = await Store.findOne({ code });
  if (existing) {
    throw ApiError.conflict('Store with this code already exists');
  }

  // Create the store with role-based assignment
  const storeData: any = {
    // Removed company field since we're removing company context
    name,
    code,
    phone,
    email,
    address,
    city,
    state,
    postalCode,
    country,
    bankName,
    bankAccountNumber,
    ifscCode,
    ibanCode,
    taxCode
  };

  // Assign the store to the selected role
  if (managerId) {
    if (managerId === 'purchaser') {
      // We'll use a special identifier to indicate this store is assigned to the purchaser role
      storeData.purchaser = 'ROLE_PURCHASER';
    } else if (managerId === 'biller') {
      // We'll use a special identifier to indicate this store is assigned to the biller role
      storeData.biller = 'ROLE_BILLER';
    }
    // We can also set a generic manager for administrative purposes
    storeData.manager = 'ROLE_MANAGER';
  }

  const store = await Store.create(storeData);

  const populatedStore = await Store.findById(store._id)
    .populate('manager', 'firstName lastName email')
    .populate('purchaser', 'firstName lastName email')
    .populate('biller', 'firstName lastName email');

  await logAudit(
    req,
    'Store Management',
    'Store Creation',
    populatedStore?.code || store.code,
    `Created store "${populatedStore?.name || store.name}" (Code: ${populatedStore?.code || store.code}).`
  );

  return respond(res, StatusCodes.CREATED, populatedStore, { message: 'Store created successfully' });
});

export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const store = await Store.findById(req.params.id);

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  const { name, managerId, phone, email, address, city, state, postalCode, country, bankName, bankAccountNumber, ifscCode, ibanCode, taxCode, isActive } = req.body;

  const changedFields: string[] = [];
  if (name && name !== store.name) {
    changedFields.push(`name: "${store.name}" -> "${name}"`);
    store.name = name;
  }
  if (phone !== undefined && phone !== store.phone) {
    changedFields.push(`phone: "${store.phone || ''}" -> "${phone}"`);
    store.phone = phone;
  }
  if (email !== undefined && email !== store.email) {
    changedFields.push(`email: "${store.email || ''}" -> "${email}"`);
    store.email = email;
  }
  if (address !== undefined && address !== store.address) {
    changedFields.push(`address: updated`);
    store.address = address;
  }
  if (city !== undefined && city !== store.city) {
    changedFields.push(`city: "${store.city || ''}" -> "${city}"`);
    store.city = city;
  }
  if (state !== undefined && state !== store.state) {
    changedFields.push(`state: "${store.state || ''}" -> "${state}"`);
    store.state = state;
  }
  if (postalCode !== undefined && postalCode !== store.postalCode) {
    changedFields.push(`postalCode: "${store.postalCode || ''}" -> "${postalCode}"`);
    store.postalCode = postalCode;
  }
  if (country !== undefined && country !== store.country) {
    changedFields.push(`country: "${store.country || ''}" -> "${country}"`);
    store.country = country;
  }
  if (bankName !== undefined && bankName !== store.bankName) {
    changedFields.push(`bankName: "${store.bankName || ''}" -> "${bankName}"`);
    store.bankName = bankName;
  }
  if (bankAccountNumber !== undefined && bankAccountNumber !== store.bankAccountNumber) {
    changedFields.push(`bankAccountNumber: "${store.bankAccountNumber || ''}" -> "${bankAccountNumber}"`);
    store.bankAccountNumber = bankAccountNumber;
  }
  if (ifscCode !== undefined && ifscCode !== store.ifscCode) {
    changedFields.push(`ifscCode: "${store.ifscCode || ''}" -> "${ifscCode}"`);
    store.ifscCode = ifscCode;
  }
  if (ibanCode !== undefined && ibanCode !== store.ibanCode) {
    changedFields.push(`ibanCode: "${store.ibanCode || ''}" -> "${ibanCode}"`);
    store.ibanCode = ibanCode;
  }
  if (taxCode !== undefined && taxCode !== store.taxCode) {
    changedFields.push(`taxCode: "${store.taxCode || ''}" -> "${taxCode}"`);
    store.taxCode = taxCode;
  }
  if (typeof isActive === 'boolean' && isActive !== store.isActive) {
    changedFields.push(`isActive: ${store.isActive} -> ${isActive}`);
    store.isActive = isActive;
  }

  // Handle role-based assignment
  if (managerId !== undefined) {
    if (managerId === null || managerId === '') {
      changedFields.push(`role assignments: cleared`);
      store.purchaser = undefined;
      store.biller = undefined;
      store.manager = undefined;
    } else {
      if (managerId === 'purchaser') {
        store.purchaser = 'ROLE_PURCHASER';
        store.biller = undefined;
      } else if (managerId === 'biller') {
        store.biller = 'ROLE_BILLER';
        store.purchaser = undefined;
      }
      store.manager = 'ROLE_MANAGER';
      changedFields.push(`assigned role: "${managerId}"`);
    }
  }

  await store.save();

  const updatedStore = await Store.findById(store._id)
    .populate('manager', 'firstName lastName email')
    .populate('purchaser', 'firstName lastName email')
    .populate('biller', 'firstName lastName email');

  if (changedFields.length > 0) {
    await logAudit(
      req,
      'Store Management',
      'Store Update',
      updatedStore?.code || store.code,
      `Updated store "${updatedStore?.name || store.name}": ${changedFields.join(', ')}.`
    );
  }

  return respond(res, StatusCodes.OK, updatedStore, { message: 'Store updated successfully' });
});

export const listStores = asyncHandler(async (req: Request, res: Response) => {
  // Get user info from request
  const userId = req.query.userId as string || (req.user ? req.user.id : null);
  const userRole = req.query.userRole as string || (req.user as any)?.role || (req.user as any)?.role_name;

  // Build base query conditions
  const baseFilters: any = { isActive: true };

  // Add search functionality if provided
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search as string, 'i');
    baseFilters.$or = [
      { name: searchRegex },
      { code: searchRegex }
    ];
  }

  // Log initial request info
  console.log('=== Store List Request ===');
  console.log('Query params:', req.query);
  console.log('User from req.user:', req.user);
  console.log('Extracted userId:', userId);
  console.log('Extracted userRole:', userRole);

  let stores: any[];

  // Apply role-based filtering
  if (userRole && userRole !== 'admin' && userRole !== 'superadmin') {
    // For non-admin users, filter based on their role
    if (userRole === 'purchaser') {
      baseFilters.purchaser = 'ROLE_PURCHASER';
    } else if (userRole === 'biller') {
      baseFilters.biller = 'ROLE_BILLER';
    } else {
      // For other roles, return empty array
      console.log('Unknown role, returning empty array');
      return respond(res, StatusCodes.OK, []);
    }
  }

  // Log the final filters
  console.log('Final baseFilters:', JSON.stringify(baseFilters, null, 2));

  // First, let's check all stores to see what's in the database
  const allStores = await Store.find({ isActive: true }).select('name code purchaser biller manager');
  console.log('All active stores in database:');
  allStores.forEach(store => {
    console.log(`- ${store.name} (${store.code}): purchaser=${store.purchaser}, biller=${store.biller}, manager=${store.manager}`);
  });

  // Execute the query
  stores = await Store.find(baseFilters)
    .populate('manager', 'firstName lastName email')
    .populate('purchaser', 'firstName lastName email')
    .populate('biller', 'firstName lastName email')
    .sort({ name: 1 });

  // Log for debugging
  console.log('Store filtering - userRole:', userRole);
  console.log('Store filtering - baseFilters:', baseFilters);
  console.log('Store filtering - found stores:', stores.length);
  console.log('Found stores:', stores.map(s => ({ name: s.name, code: s.code, purchaser: s.purchaser, biller: s.biller })));
  console.log('=== End Store List Request ===');

  return respond(res, StatusCodes.OK, stores);
});

export const getStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const store = await Store.findOne({ _id: req.params.id, isActive: true })
    .populate('manager', 'firstName lastName email')
    .populate('purchaser', 'firstName lastName email')
    .populate('biller', 'firstName lastName email');

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  await logAudit(
    req,
    'Store Management',
    'Store View',
    store.code,
    `Viewed details of store "${store.name}" (Code: ${store.code}).`
  );

  return respond(res, StatusCodes.OK, store);
});

export const deleteStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const store = await Store.findById(req.params.id);

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  // Check if store has any associated inventory records
  const inventoryCount = await Inventory.countDocuments({ store: store._id });
  
  if (inventoryCount > 0) {
    throw ApiError.badRequest('Cannot delete store with associated inventory records');
  }

  // Instead of deleting, we'll mark it as inactive
  store.isActive = false;
  await store.save();

  await logAudit(
    req,
    'Store Management',
    'Store Deactivation',
    store.code,
    `Deactivated store "${store.name}" (Code: ${store.code}).`
  );

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Store deactivated successfully' });
});