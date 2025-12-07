import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Item } from '../models/item.model';
import { Category, type CategoryDocument } from '../models/category.model';
import { Vendor, type VendorDocument } from '../models/vendor.model';
import { Supplier, type SupplierDocument } from '../models/supplier.model';
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
  
  // Extract fields from request body
  // Note: 'code' is now optional and will be auto-generated if not provided
  const {
    name,
    code, // Optional - will be auto-generated if not provided
    category: categoryId,
    description,
    unitOfMeasure,
    vendorId, // Changed from vendor to vendorId to match frontend
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    paidAmount,
    returnAmount,
    balanceAmount,
    additionalAttributes,
    videoType,
    youtubeLink
  } = req.body;

  // Validate category exists
  console.log('Received category ID:', categoryId);
  console.log('Category ID type:', typeof categoryId);
  
  // Check if categoryId is a valid MongoDB ObjectId
  if (!categoryId || typeof categoryId !== 'string') {
    console.error('Invalid category ID format - not a string:', categoryId);
    throw ApiError.badRequest('Invalid category ID format');
  }
  
  // Try to find the category
  const category: CategoryDocument | null = await Category.findById(categoryId);
  if (!category) {
    console.error('Invalid category ID provided:', categoryId);
    throw ApiError.badRequest('Invalid category');
  }
  console.log('Found category:', category);

  // Validate vendor if provided
  let vendorObj: Types.ObjectId | undefined = undefined;
  if (vendorId !== undefined) {  // Changed from if (vendorId) to properly handle empty string
    if (vendorId === '' || vendorId === null) {
      // If vendorId is explicitly set to empty/null, remove the vendor reference
      vendorObj = undefined;
    } else {
      // Use Supplier model instead of Vendor model
      const supplierDoc = await Supplier.findById(vendorId);
      if (!supplierDoc) {
        throw ApiError.badRequest('Invalid supplier');
      }
      // Type assertion to ensure supplier._id is treated as Types.ObjectId
      vendorObj = supplierDoc._id as unknown as Types.ObjectId;
    }
  }

  // Auto-generate item code if not provided
  let itemCode = code;
  if (!itemCode) {
    // Generate a unique item ID based on date with sequential numbering
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`; // YYYYMMDD format
    
    // Format: ITMYYYYMMDDNNN (e.g., ITM20251207001)
    const prefix = `ITM${dateStr}`;
    
    // Find the highest sequence number for today
    const regex = new RegExp(`^${prefix}(\\d{3})$`);
    const existingItems = await Item.find({ code: regex }).select('code');
    
    let nextSequence = 1;
    if (existingItems.length > 0) {
      // Extract sequence numbers and find the highest
      const sequenceNumbers = existingItems
        .map(item => {
          const match = item.code.match(regex);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => !isNaN(num));
      
      if (sequenceNumbers.length > 0) {
        nextSequence = Math.max(...sequenceNumbers) + 1;
      }
    }
    
    // Format sequence number as 3-digit string with leading zeros
    const sequenceStr = nextSequence.toString().padStart(3, '0');
    itemCode = `${prefix}${sequenceStr}`;
  }

  // Check for duplicate item code
  const existing = await Item.findOne({ code: itemCode });
  if (existing) {
    throw ApiError.conflict('Item with this code already exists');
  }

  const item = await Item.create({
    // Removed company field since we're removing company context
    name,
    code: itemCode, // Use the auto-generated or provided code
    category: category._id,
    description,
    unitOfMeasure,
    vendor: vendorObj, // Use vendorObj instead of vendorId
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    paidAmount: typeof paidAmount === 'number' ? paidAmount : undefined,
    returnAmount: typeof returnAmount === 'number' ? returnAmount : undefined,
    balanceAmount: typeof balanceAmount === 'number' ? balanceAmount : undefined,
    additionalAttributes,
    videoType,
    youtubeLink
  });

  // Populate vendor name for the response
  await item.populate('vendor', 'name contactPerson');

  return respond(res, StatusCodes.CREATED, item, {
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
    vendorId, // Changed from vendor to vendorId to match frontend
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    paidAmount,
    returnAmount,
    balanceAmount,
    additionalAttributes,
    videoType,
    youtubeLink,
    isActive
  } = req.body;

  if (typeof paidAmount === 'number') itemDoc.paidAmount = paidAmount;
  if (typeof returnAmount === 'number') itemDoc.returnAmount = returnAmount;
  if (typeof balanceAmount === 'number') itemDoc.balanceAmount = balanceAmount;
  if (categoryId) {
    console.log('Validating category ID for update:', categoryId);
    console.log('Category ID type for update:', typeof categoryId);
    
    // Check if categoryId is a valid MongoDB ObjectId
    if (typeof categoryId !== 'string') {
      console.error('Invalid category ID format for update - not a string:', categoryId);
      throw ApiError.badRequest('Invalid category ID format');
    }
    
    const category = await Category.findById(categoryId);
    if (!category) {
      console.error('Invalid category ID provided for update:', categoryId);
      throw ApiError.badRequest('Invalid category');
    }
    (itemDoc as any).category = category._id;
    console.log('Updated category reference:', category._id);
  }

  // Validate vendor if provided
  if (vendorId !== undefined) {  // Changed from if (vendorId) to properly handle empty string
    if (vendorId === '' || vendorId === null) {
      // If vendorId is explicitly set to empty/null, remove the vendor reference
      (itemDoc as any).vendor = undefined;
    } else {
      // Use Supplier model instead of Vendor model
      const supplier = await Supplier.findById(vendorId);
      if (!supplier) {
        throw ApiError.badRequest('Invalid supplier');
      }
      (itemDoc as any).vendor = supplier._id;
    }
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