import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Store, type StoreDocument } from '../models/store.model';
import { User, type UserDocument } from '../models/user.model';
import { Inventory } from '../models/inventory.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const listStores = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const stores = await Store.find({ company: companyId, isActive: true })
    .populate('manager', 'firstName lastName email')
    .populate('parent', 'name code type')
    .sort({ name: 1 });

  return respond(res, StatusCodes.OK, stores);
});

export const createStore = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { name, code, type, parentId, managerId, phone, email, address, city, state, postalCode, country, bankName, bankAccountNumber, ifscCode, ibanCode, taxCode, directPurchaseAllowed } = req.body;

  const existing = await Store.findOne({ company: companyId, code });
  if (existing) {
    throw ApiError.conflict('Store with this code already exists');
  }

  // Validate type
  if (type && !['Central Store', 'Branch Store'].includes(type)) {
    throw ApiError.badRequest('Invalid store type. Must be "Central Store" or "Branch Store"');
  }

  // Validate parent for branch stores
  let parent: StoreDocument | null = null;
  if (parentId) {
    parent = await Store.findOne({ _id: parentId, company: companyId, isActive: true });
    if (!parent) {
      throw ApiError.badRequest('Invalid parent store');
    }
    // if (parent.type !== 'Central Store') {
    //   throw ApiError.badRequest('Parent store must be a Central Store');
    // }
  }

  // If type is Branch Store, parent is required
  const storeType = type || 'Branch Store';
  if (storeType === 'Branch Store' && !parentId) {
    throw ApiError.badRequest('Branch Store must have a parent store');
  }

  // If type is Central Store, parent should be null
  if (storeType === 'Central Store' && parentId) {
    throw ApiError.badRequest('Central Store cannot have a parent');
  }

  let manager: UserDocument | null = null;
  if (managerId) {
    manager = await User.findOne({ _id: managerId, company: companyId });
    if (!manager) {
      throw ApiError.badRequest('Invalid store manager');
    }
  }

  const store = await Store.create({
    company: companyId,
    name,
    code,
    type: storeType,
    parent: parent ? parent._id : undefined,
    manager: manager ? manager._id : undefined,
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
    taxCode,
    directPurchaseAllowed
  });

  const populatedStore = await Store.findById(store._id)
    .populate('manager', 'firstName lastName email')
    .populate('parent', 'name code type');

  return respond(res, StatusCodes.CREATED, populatedStore, { message: 'Store created successfully' });
});

export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const store = await Store.findOne({ _id: req.params.id, company: companyId });

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  const { name, type, parentId, managerId, phone, email, address, city, state, postalCode, country, bankName, bankAccountNumber, ifscCode, ibanCode, taxCode, directPurchaseAllowed, isActive } = req.body;

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
  if (typeof directPurchaseAllowed === 'boolean') store.directPurchaseAllowed = directPurchaseAllowed;
  if (typeof isActive === 'boolean') store.isActive = isActive;

  // Handle type change
  if (type && ['Central Store', 'Branch Store'].includes(type)) {
    // If changing to Central Store, remove parent
    if (type === 'Central Store') {
      store.parent = undefined;
    }
    // If changing to Branch Store, validate parent
    else if (type === 'Branch Store' && !parentId && !store.parent) {
      throw ApiError.badRequest('Branch Store must have a parent Central Store');
    }
    store.type = type;
  }

  // Handle parent change
  if (parentId !== undefined) {
    if (parentId === null || parentId === '') {
      if (store.type === 'Branch Store') {
        throw ApiError.badRequest('Branch Store must have a parent Central Store');
      }
      store.parent = undefined;
    } else {
      const parent = await Store.findOne({ _id: parentId, company: companyId, isActive: true });
      if (!parent) {
        throw ApiError.badRequest('Invalid parent store');
      }
      // if (parent.type !== 'Central Store') {
      //   throw ApiError.badRequest('Parent store must be a Central Store');
      // }
      if (parent._id.toString() === store._id.toString()) {
        throw ApiError.badRequest('Store cannot be its own parent');
      }
      store.parent = parent._id;
    }
  }

  if (managerId !== undefined) {
    if (managerId === null || managerId === '') {
      store.manager = undefined;
    } else {
      const manager = await User.findOne({ _id: managerId, company: companyId });
      if (!manager) {
        throw ApiError.badRequest('Invalid store manager');
      }
      store.manager = manager._id;
    }
  }

  await store.save();

  const updatedStore = await Store.findById(store._id)
    .populate('manager', 'firstName lastName email')
    .populate('parent', 'name code type');

  return respond(res, StatusCodes.OK, updatedStore, { message: 'Store updated successfully' });
});

export const getStore = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const store = await Store.findOne({ _id: req.params.id, company: companyId, isActive: true })
    .populate('manager', 'firstName lastName email')
    .populate('parent', 'name code type');

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  return respond(res, StatusCodes.OK, store);
});

export const deleteStore = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const store = await Store.findOne({ _id: req.params.id, company: companyId });

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  // Check if store has child stores (branch stores)
  const childStores = await Store.find({ parent: store._id, company: companyId, isActive: true });
  if (childStores.length > 0) {
    throw ApiError.badRequest('Cannot delete store: It has connected branch stores');
  }

  // Check if store is used in inventory (which may be linked to purchase orders)
  const inventoryCount = await Inventory.countDocuments({ store: store._id, company: companyId });
  if (inventoryCount > 0) {
    throw ApiError.badRequest('Cannot delete store: It is used in inventory records');
  }

  store.isActive = false;
  await store.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Store deactivated successfully' });
});

