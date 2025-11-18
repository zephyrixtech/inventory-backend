import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { Item } from '../models/item.model';
import { Category } from '../models/category.model';
import { Vendor } from '../models/vendor.model';
import { StoreStock } from '../models/store-stock.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listItems = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { categoryId, search, status } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = { company: companyId };

  if (categoryId && categoryId !== 'all') {
    filters.category = categoryId;
  }

  if (status && status !== 'all') {
    filters.status = status;
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

  const itemIds = items.map((item) => item._id);
  const stockRecords = await StoreStock.find({ company: companyId, product: { $in: itemIds } });
  const stockMap = new Map<string, number>();
  stockRecords.forEach((record) => {
    stockMap.set(record.product.toString(), record.quantity);
  });

  const payload = items.map((item) => ({
    ...item.toObject(),
    availableStock: stockMap.get(item._id.toString()) ?? item.quantity ?? 0
  }));

  return respond(res, StatusCodes.OK, payload, buildPaginationMeta(page, limit, total));
});

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const item = await Item.findOne({ _id: req.params.id, company: companyId }).populate('category', 'name').populate('vendor', 'name contactPerson');

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  return respond(res, StatusCodes.OK, item);
});

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { name, code, categoryId, description, reorderLevel, maxLevel, unitOfMeasure, vendorId, unitPrice, currency, quantity, purchaseDate, status } = req.body;

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

  const item = await Item.create({
    company: companyId,
    name,
    code,
    category: category._id,
    description,
    reorderLevel,
    maxLevel,
    unitOfMeasure,
    vendor: vendorObjectId,
    unitPrice,
    currency,
    quantity,
    purchaseDate,
    status
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

  const item = await Item.findOne({ _id: req.params.id, company: companyId });

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  const { name, categoryId, description, reorderLevel, maxLevel, unitOfMeasure, isActive, vendorId, unitPrice, currency, quantity, purchaseDate, status } = req.body;

  if (name) item.name = name;
  if (description) item.description = description;
  if (typeof reorderLevel === 'number') item.reorderLevel = reorderLevel;
  if (typeof maxLevel === 'number') item.maxLevel = maxLevel;
  if (unitOfMeasure) item.unitOfMeasure = unitOfMeasure;
  if (typeof isActive === 'boolean') item.isActive = isActive;
  if (typeof unitPrice === 'number') item.unitPrice = unitPrice;
  if (typeof quantity === 'number') item.quantity = quantity;
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

  const item = await Item.findOne({ _id: req.params.id, company: companyId });

  if (!item) {
    throw ApiError.notFound('Item not found');
  }

  item.isActive = false;
  await item.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Item deactivated successfully' });
});

