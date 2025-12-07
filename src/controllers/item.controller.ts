import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Item } from '../models/item.model';
import { Category, type CategoryDocument } from '../models/category.model';
import { Vendor, type VendorDocument } from '../models/vendor.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listItem = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { status, search, category, vendor } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};
  // Removed company filter since we're removing company context

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (search && typeof search === 'string') {
    filters.$or = [{ name: new RegExp(search, 'i') }, { code: new RegExp(search, 'i') }];
  }

  if (category) {
    filters.category = category;
  }

  if (vendor) {
    filters.vendor = vendor;
  }

  const query = Item.find(filters).populate('category', 'name').populate('vendor', 'name');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [items, total] = await Promise.all([query.exec(), Item.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, items, buildPaginationMeta(page, limit, total));
});

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const item = await Item.findById(req.params.id).populate('category', 'name').populate('vendor', 'name');

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  return respond(res, StatusCodes.OK, item);
});

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const {
    name,
    code,
    category: categoryId,
    description,
    unitOfMeasure,
    vendor: vendorId,
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    paidAmount,
    returnAmount,
    additionalAttributes,
    videoType,
    youtubeLink
  } = req.body;

  // Validate category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    throw ApiError.badRequest('Invalid category');
  }

  // Validate vendor if provided
  let vendor: VendorDocument | null = null;
  if (vendorId) {
    const vendor = await Supplier.findOne({ _id: vendorId, company: companyId }); // Changed from Vendor to Supplier
    if (!vendor) {
      throw ApiError.badRequest('Invalid vendor');
    }
  }

  // Check for duplicate item code
  const existing = await Item.findOne({ code });
  if (existing) {
    throw ApiError.conflict('Item with this code already exists');
  }

  const item = await Item.create({
    // Removed company field since we're removing company context
    name,
    code,
    category: category._id,
    description,
    unitOfMeasure,
    vendor: vendor?._id,
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    paidAmount: typeof paidAmount === 'number' ? paidAmount : undefined,
    returnAmount: typeof returnAmount === 'number' ? returnAmount : undefined,
    additionalAttributes: sanitizedAdditionalAttributes,
    videoType: normalizedVideoType,
    youtubeLink: sanitizedYoutubeLink,
    videoUrl: sanitizedVideoUrl
  });

  return respond(res, StatusCodes.CREATED, await item.populate('vendor', 'name contactPerson'), {
    message: 'Item created successfully'
  });
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const itemDoc = await Item.findById(req.params.id);

  if (!itemDoc) {
    throw ApiError.notFound('Item not found');
  }

  const {
    name,
    code,
    category: categoryId,
    description,
    unitOfMeasure,
    vendor: vendorId,
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    paidAmount,
    returnAmount,
    additionalAttributes,
    videoType,
    youtubeLink,
    isActive
  } = req.body;

  if (name) item.name = name;
  if (description) item.description = description;
  if (unitOfMeasure) item.unitOfMeasure = unitOfMeasure;
  if (typeof isActive === 'boolean') item.isActive = isActive;
  if (typeof unitPrice === 'number') item.unitPrice = unitPrice;
  if (typeof quantity === 'number') {
    item.quantity = quantity;
    const damaged = item.damagedQuantity || 0;
    item.availableQuantity = Math.max(0, quantity - damaged);
  }
  if (currency) item.currency = currency;
  if (purchaseDate) item.purchaseDate = purchaseDate;
  if (status) item.status = status;
  if (typeof paidAmount === 'number') item.paidAmount = paidAmount;
  if (typeof returnAmount === 'number') item.returnAmount = returnAmount;
  if (categoryId) {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw ApiError.badRequest('Invalid category');
    }
    (itemDoc as any).category = category._id;
  }

  // Validate vendor if provided
  if (vendorId) {
    const vendor = await Supplier.findOne({ _id: vendorId, company: companyId });
    if (!vendor) {
      throw ApiError.badRequest('Invalid vendor');
    }
    (itemDoc as any).vendor = vendor._id;
  }

  // Check for duplicate item code (if code is being changed)
  if (code && code !== itemDoc.code) {
    const existing = await Item.findOne({ code });
    if (existing) {
      throw ApiError.conflict('Item with this code already exists');
    }
    itemDoc.code = code;
  }

  // Update fields
  if (name !== undefined) itemDoc.name = name;
  if (description !== undefined) itemDoc.description = description;
  if (unitOfMeasure !== undefined) itemDoc.unitOfMeasure = unitOfMeasure;
  if (unitPrice !== undefined) itemDoc.unitPrice = unitPrice;
  if (currency !== undefined) itemDoc.currency = currency;
  if (quantity !== undefined) itemDoc.quantity = quantity;
  if (purchaseDate !== undefined) itemDoc.purchaseDate = purchaseDate;
  if (status !== undefined) itemDoc.status = status;
  if (additionalAttributes !== undefined) itemDoc.additionalAttributes = additionalAttributes;
  if (videoType !== undefined) itemDoc.videoType = videoType;
  if (youtubeLink !== undefined) itemDoc.youtubeLink = youtubeLink;
  if (typeof isActive === 'boolean') itemDoc.isActive = isActive;

  await itemDoc.save();
  await itemDoc.populate('category', 'name');
  await itemDoc.populate('vendor', 'name');

  return respond(res, StatusCodes.OK, itemDoc, { message: 'Item updated successfully' });
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const item = await Item.findById(req.params.id);

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  await Item.deleteOne({ _id: item._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Item deleted successfully' });
});