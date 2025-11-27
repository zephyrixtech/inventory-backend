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
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = { company: companyId };

  if (search && typeof search === 'string') {
    const matchingProducts = await Item.find({
      company: companyId,
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
  const companyId = req.companyId;
  if (!companyId || !req.user) {
    throw ApiError.badRequest('Company context missing');
  }

  const { productId, storeId, quantity, margin, currency } = req.body;

  const product = await Item.findOne({ _id: productId, company: companyId });

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
  const priceAfterMargin = basePrice + (basePrice * marginPercentage) / 100;

  const stock = await StoreStock.findOneAndUpdate(
    { company: companyId, product: product._id, store: storeId ? new Types.ObjectId(storeId) : null },
    {
      quantity,
      margin: marginPercentage,
      currency: currency ?? product.currency ?? 'INR',
      priceAfterMargin,
      ...(storeId && { store: new Types.ObjectId(storeId) }),
      lastUpdatedBy: new Types.ObjectId(req.user.id)
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('product', 'name code currency unitPrice quantity status')
    .populate('store', 'name code type');

  return respond(res, StatusCodes.OK, stock, { message: 'Store stock updated successfully' });
});

export const adjustStockQuantity = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId || !req.user) {
    throw ApiError.badRequest('Company context missing');
  }

  const { quantity } = req.body;

  const stock = await StoreStock.findOne({ _id: req.params.id, company: companyId });

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

