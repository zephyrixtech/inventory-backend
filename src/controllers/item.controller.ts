import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Item } from '../models/item.model';
import { Vendor, type VendorDocument } from '../models/vendor.model';
import { Supplier, type SupplierDocument } from '../models/supplier.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listItem = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { status, search, vendor, billNumber } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};
  // Removed company filter since we're removing company context

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (search && typeof search === 'string') {
    filters.$or = [{ name: new RegExp(search, 'i') }, { code: new RegExp(search, 'i') }];
  }

  if (vendor) {
    filters.vendor = vendor;
  }

  // Add billNumber filter for exact match
  if (billNumber && typeof billNumber === 'string') {
    filters.billNumber = new RegExp(billNumber, 'i');
  }

  const query = Item.find(filters).populate('vendor', '_id name');

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

  const item = await Item.findById(req.params.id).populate('vendor', '_id name');

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
    billNumber, // Changed from category to billNumber
    description,
    unitOfMeasure,
    vendorId, // Changed from vendor to vendorId to match frontend
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    additionalAttributes,
    videoType,
    youtubeLink
  } = req.body;

  // Validate billNumber is provided
  console.log('Received bill number:', billNumber);
  console.log('Bill number type:', typeof billNumber);
  
  if (!billNumber || typeof billNumber !== 'string' || billNumber.trim() === '') {
    console.error('Invalid bill number provided:', billNumber);
    throw ApiError.badRequest('Bill number is required');
  }

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
    billNumber: billNumber.trim(), // Use billNumber instead of category
    description,
    unitOfMeasure,
    vendor: vendorObj, // Use vendorObj instead of vendorId
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    additionalAttributes,
    videoType,
    youtubeLink
  });

  // Populate vendor name for the response
  await item.populate('vendor', '_id name');

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
    billNumber, // Changed from category to billNumber
    description,
    unitOfMeasure,
    vendorId, // Changed from vendor to vendorId to match frontend
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    additionalAttributes,
    videoType,
    youtubeLink,
    isActive
  } = req.body;

  // Validate billNumber if provided
  if (billNumber !== undefined) {
    console.log('Validating bill number for update:', billNumber);
    console.log('Bill number type for update:', typeof billNumber);
    
    if (typeof billNumber !== 'string' || billNumber.trim() === '') {
      console.error('Invalid bill number format for update:', billNumber);
      throw ApiError.badRequest('Bill number must be a non-empty string');
    }
    
    itemDoc.billNumber = billNumber.trim();
    console.log('Updated bill number:', billNumber.trim());
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
  await itemDoc.populate('vendor', '_id name');

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