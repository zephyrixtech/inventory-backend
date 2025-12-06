import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Store, type StoreDocument } from '../models/store.model';
import { User, type UserDocument } from '../models/user.model';
import { Inventory } from '../models/inventory.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

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

  return respond(res, StatusCodes.CREATED, populatedStore, { message: 'Store created successfully' });
});

export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const store = await Store.findById(req.params.id);

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  const { name, managerId, phone, email, address, city, state, postalCode, country, bankName, bankAccountNumber, ifscCode, ibanCode, taxCode, isActive } = req.body;

  if (name) store.name = name;
  if (phone !== undefined) store.phone = phone;
  if (email !== undefined) store.email = email;
  if (address !== undefined) store.address = address;
  if (city !== undefined) store.city = city;
  if (state !== undefined) store.state = state;
  if (postalCode !== undefined) store.postalCode = postalCode;
  if (country !== undefined) store.country = country;
  if (bankName !== undefined) store.bankName = bankName;
  if (bankAccountNumber !== undefined) store.bankAccountNumber = bankAccountNumber;
  if (ifscCode !== undefined) store.ifscCode = ifscCode;
  if (ibanCode !== undefined) store.ibanCode = ibanCode;
  if (taxCode !== undefined) store.taxCode = taxCode;
  if (typeof isActive === 'boolean') store.isActive = isActive;

  // Handle role-based assignment
  if (managerId !== undefined) {
    if (managerId === null || managerId === '') {
      // Clear all role assignments
      store.purchaser = undefined;
      store.biller = undefined;
      store.manager = undefined;
    } else {
      // Assign the store to the selected role
      if (managerId === 'purchaser') {
        store.purchaser = 'ROLE_PURCHASER';
        store.biller = undefined;
      } else if (managerId === 'biller') {
        store.biller = 'ROLE_BILLER';
        store.purchaser = undefined;
      }
      // We can also set a generic manager for administrative purposes
      store.manager = 'ROLE_MANAGER';
    }
  }

  await store.save();

  const updatedStore = await Store.findById(store._id)
    .populate('manager', 'firstName lastName email')
    .populate('purchaser', 'firstName lastName email')
    .populate('biller', 'firstName lastName email');

  return respond(res, StatusCodes.OK, updatedStore, { message: 'Store updated successfully' });
});

export const listStores = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  
  // Get user info from request if available
  const userId = req.query.userId as string || (req.user ? req.user.id : null);
  const userRole = req.query.userRole as string || null;

  // Build query conditions
  const queryConditions: any = { isActive: true };

  // If user is purchaser or biller, only show stores where their role is assigned
  if (userId && userRole) {
    if (userRole === 'purchaser') {
      // Show stores where the purchaser role is assigned
      queryConditions.$or = [
        { purchaser: 'ROLE_PURCHASER' },
        { manager: 'ROLE_MANAGER' }
      ];
    } else if (userRole === 'biller') {
      // Show stores where the biller role is assigned
      queryConditions.$or = [
        { biller: 'ROLE_BILLER' },
        { manager: 'ROLE_MANAGER' }
      ];
    }
    // For admin and superadmin, show all stores (no additional filtering)
  }

  const stores = await Store.find(queryConditions)
    .populate('manager', 'firstName lastName email')
    .populate('purchaser', 'firstName lastName email')
    .populate('biller', 'firstName lastName email')
    .sort({ name: 1 });

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

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Store deactivated successfully' });
});