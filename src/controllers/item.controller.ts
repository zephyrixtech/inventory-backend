import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { Item } from '../models/item.model';
import { Category } from '../models/category.model';
import { Vendor } from '../models/vendor.model';
import { StoreStock } from '../models/store-stock.model';
import { Supplier } from '../models/supplier.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const listItems = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { categoryId, search, status, qcStatus, isActive } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = { company: companyId };

  if (typeof isActive === 'string') {
    if (isActive === 'true') {
      filters.isActive = true;
    } else if (isActive === 'false') {
      filters.isActive = false;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(filters, 'isActive')) {
    filters.isActive = true;
  }

  if (categoryId && categoryId !== 'all') {
    filters.category = categoryId;
  }

  if (status && status !== 'all') {
    filters.status = status;
  }

  const qcStatusValue = typeof qcStatus === 'string' ? qcStatus : undefined;
  if (qcStatusValue && ['pending', 'approved', 'rejected'].includes(qcStatusValue)) {
    filters.qcStatus = qcStatusValue;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { code: new RegExp(search, 'i') },
      { currency: new RegExp(search, 'i') }
    ];
  }

  const query = Item.find(filters).populate('category', 'name').populate('vendor', 'name contactPerson');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [items, total] = await Promise.all([query.exec(), Item.countDocuments(filters)]);

  const itemsMissingVendor = items.filter((item) => !item.vendor).map((item) => (item as any)._id.toString());
  const supplierFallbackMap = new Map<
    string,
    {
      _id: Types.ObjectId;
      name: string;
      contactPerson?: string;
    }
  >();

  if (itemsMissingVendor.length > 0) {
    const suppliers = await Supplier.find({
      company: companyId,
      selectedSupplies: { $in: itemsMissingVendor }
    })
      .select(['name', 'contactPerson', 'selectedSupplies']);

    suppliers.forEach((supplier) => {
      supplier.selectedSupplies?.forEach((productId) => {
        supplierFallbackMap.set(productId.toString(), {
          _id: supplier._id,
          name: supplier.name,
          contactPerson: supplier.contactPerson
        });
      });
    });
  }

  const itemIds = items.map((item) => item._id);
  const stockRecords = await StoreStock.find({ company: companyId, product: { $in: itemIds } });
  const stockMap = new Map<string, number>();
  stockRecords.forEach((record) => {
    stockMap.set(record.product.toString(), record.quantity);
  });

  const payload = items.map((item) => {
    const serialized = item.toObject();
    if (!serialized.vendor) {
      const fallback = supplierFallbackMap.get((item as any)._id.toString());
      if (fallback) {
        serialized.vendor = fallback as any;
      }
    }

    return {
      ...serialized,
      availableStock: stockMap.get((item as any)._id.toString()) ?? item.quantity ?? 0
    };
  });

  return respond(res, StatusCodes.OK, payload, buildPaginationMeta(page, limit, total));
});

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const itemId = req.params.id;
  if (!Types.ObjectId.isValid(itemId)) {
    throw ApiError.badRequest('Invalid item ID format');
  }

  const item = await Item.findOne({ _id: new Types.ObjectId(itemId), company: companyId })
    .populate('category', 'name')
    .populate('vendor', 'name contactPerson');

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  const itemData = item.toObject();
  itemData.additionalAttributes = isPlainObject(itemData.additionalAttributes)
    ? itemData.additionalAttributes
    : {};
  itemData.videoType = itemData.videoType || 'upload';
  itemData.youtubeLink = typeof itemData.youtubeLink === 'string' ? itemData.youtubeLink : null;
  itemData.videoUrl = typeof itemData.videoUrl === 'string' ? itemData.videoUrl : null;

  return respond(res, StatusCodes.OK, itemData);
});

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const {
    name,
    code,
    categoryId,
    description,
    reorderLevel,
    maxLevel,
    unitOfMeasure,
    vendorId,
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    additionalAttributes,
    videoType,
    youtubeLink,
    videoUrl
  } = req.body;

  const existing = await Item.findOne({ company: companyId, code });
  if (existing) {
    throw ApiError.conflict('Item with this code already exists');
  }

  const category = await Category.findOne({ _id: categoryId, company: companyId, isActive: true });
  if (!category) {
    throw ApiError.badRequest('Invalid category');
  }

  let vendorObjectId: Types.ObjectId | undefined;
  if (vendorId) {
    const vendor = await Vendor.findOne({ _id: vendorId, company: companyId });
    if (!vendor) {
      throw ApiError.badRequest('Invalid vendor');
    }
    vendorObjectId = vendor._id;
  }

  const normalizedVideoType: 'upload' | 'youtube' = videoType === 'youtube' ? 'youtube' : 'upload';
  const sanitizedYoutubeLink =
    normalizedVideoType === 'youtube' && typeof youtubeLink === 'string' && youtubeLink.trim().length > 0
      ? youtubeLink.trim()
      : undefined;
  const sanitizedVideoUrl =
    normalizedVideoType === 'upload' && typeof videoUrl === 'string' && videoUrl.trim().length > 0 ? videoUrl.trim() : undefined;
  const sanitizedAdditionalAttributes = isPlainObject(additionalAttributes) ? additionalAttributes : undefined;

  const item = await Item.create({
    company: companyId,
    name,
    code,
    category: category._id,
    description,
    unitOfMeasure,
    vendor: vendorObjectId,
    unitPrice,
    currency,
    quantity,
    damagedQuantity: 0,
    availableQuantity: quantity ?? 0,
    purchaseDate,
    status,
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
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const itemId = req.params.id;
  if (!Types.ObjectId.isValid(itemId)) {
    throw ApiError.badRequest('Invalid item ID format');
  }

  const item = await Item.findOne({ _id: new Types.ObjectId(itemId), company: companyId });

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  const {
    name,
    categoryId,
    description,
    unitOfMeasure,
    isActive,
    vendorId,
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status,
    additionalAttributes,
    videoType,
    youtubeLink,
    videoUrl
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
  if (categoryId) {
    const category = await Category.findOne({ _id: categoryId, company: companyId });
    if (!category) {
      throw ApiError.badRequest('Invalid category');
    }
    item.category = category._id;
  }
  if (vendorId) {
    const vendor = await Vendor.findOne({ _id: vendorId, company: companyId });
    if (!vendor) {
      throw ApiError.badRequest('Invalid vendor');
    }
    item.vendor = vendor._id;
  }

  if (isPlainObject(additionalAttributes)) {
    item.additionalAttributes = additionalAttributes;
  }

  if (typeof videoType === 'string') {
    item.videoType = videoType === 'youtube' ? 'youtube' : 'upload';
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'youtubeLink')) {
    if (typeof youtubeLink === 'string' && youtubeLink.trim().length > 0) {
      item.youtubeLink = youtubeLink.trim();
    } else {
      item.youtubeLink = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'videoUrl')) {
    if (typeof videoUrl === 'string' && videoUrl.trim().length > 0) {
      item.videoUrl = videoUrl.trim();
    } else {
      item.videoUrl = null;
    }
  }

  await item.save();

  return respond(res, StatusCodes.OK, await item.populate('vendor', 'name contactPerson'), {
    message: 'Item updated successfully'
  });
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const itemId = req.params.id;
  if (!Types.ObjectId.isValid(itemId)) {
    throw ApiError.badRequest('Invalid item ID format');
  }

  const item = await Item.findOne({ _id: new Types.ObjectId(itemId), company: companyId });

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  item.isActive = false;
  await item.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Item deactivated successfully' });
});

