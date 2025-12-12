import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { StoreStock } from '../models/store-stock.model';
import { Item } from '../models/item.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listStoreStock = asyncHandler(async (req: Request, res: Response) => {

  const { search, storeId } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  // Removed company context - using empty filters object
  const filters: Record<string, unknown> = {};

  if (storeId && typeof storeId === 'string') {
    filters.store = new Types.ObjectId(storeId);
  }

  if (search && typeof search === 'string') {
    const matchingProducts = await Item.find({
      // Removed company filter since we're removing company context
      $or: [{ name: new RegExp(search, 'i') }, { code: new RegExp(search, 'i') }]
    }).select('_id');
    filters.product = { $in: matchingProducts.map((p) => p._id) };
  }

  const query = StoreStock.find(filters)
    .populate('product', 'name code currency unitPrice quantity status')
    .populate('store', 'name code type')
    .populate('lastUpdatedBy', 'firstName lastName');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ updatedAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [stock, total] = await Promise.all([query.exec(), StoreStock.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, stock, buildPaginationMeta(page, limit, total));
});

export const upsertStoreStock = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { productId, storeId, quantity, margin, currency } = req.body;

  // Validate required fields
  if (!productId) {
    throw ApiError.badRequest('Product ID is required');
  }
  
  if (typeof quantity !== 'number' || quantity < 0) {
    throw ApiError.badRequest('Quantity must be a non-negative number');
  }

  // Removed company filter since we're removing company context
  const product = await Item.findById(productId);

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  if (product.status !== 'store_pending' && product.status !== 'store_approved') {
    product.status = 'store_pending';
  }

  product.storeApprovedBy = new Types.ObjectId(req.user.id);
  product.storeApprovedAt = new Date();
  product.status = 'store_approved';

  await product.save();

  const basePrice = product.unitPrice ?? 0;
  const marginPercentage = Number(margin ?? 0);
  
  // Validate margin percentage
  if (marginPercentage < 0) {
    throw ApiError.badRequest('Margin percentage cannot be negative');
  }
  
  // Validate base price
  if (basePrice < 0) {
    throw ApiError.badRequest('Product unit price cannot be negative');
  }
  
  const finalUnitPrice = basePrice + (basePrice * marginPercentage) / 100;
  
  // Validate currency
  const validCurrencies = ['INR', 'AED'];
  const selectedCurrency = currency ?? product.currency ?? 'INR';
  if (!validCurrencies.includes(selectedCurrency)) {
    throw ApiError.badRequest('Currency must be either INR or AED');
  }

  // Removed company filter since we're removing company context
  const stock = await StoreStock.findOneAndUpdate(
    { product: product._id, store: storeId ? new Types.ObjectId(storeId) : null },
    {
      quantity,
      margin: marginPercentage,
      currency: selectedCurrency,
      unitPrice: finalUnitPrice,
      ...(storeId && { store: new Types.ObjectId(storeId) }),
      lastUpdatedBy: new Types.ObjectId(req.user.id)
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('product', 'name code currency unitPrice quantity status')
    .populate('store', 'name code type');

  return respond(res, StatusCodes.OK, stock, { message: 'Store stock updated successfully' });
});

export const adjustStockQuantity = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { quantity } = req.body;

  // Removed company filter since we're removing company context
  const stock = await StoreStock.findById(req.params.id);

  if (!stock) {
    throw ApiError.notFound('Store stock record not found');
  }

  if (typeof quantity !== 'number') {
    throw ApiError.badRequest('Quantity is required');
  }

  stock.quantity = quantity;
  stock.lastUpdatedBy = new Types.ObjectId(req.user.id);

  await stock.save();

  return respond(res, StatusCodes.OK, stock, { message: 'Stock quantity adjusted successfully' });
});