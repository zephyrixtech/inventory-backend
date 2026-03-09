import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose, { Types } from 'mongoose';

import { Store } from '../models/store.model';
import { StoreStock } from '../models/store-stock.model';
import { StockTransfer } from '../models/stock-transfer.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

const isIndianStore = (country?: string): boolean => {
  const value = (country || '').trim().toLowerCase();
  if (!value) return false;
  return value === 'india' || value === 'ind' || value === 'in' || value.includes('india');
};

export const listStockTransfers = asyncHandler(async (req: Request, res: Response) => {
  const { status, fromStoreId, toStoreId } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (status && typeof status === 'string' && ['pending', 'approved', 'rejected'].includes(status)) {
    filters.status = status;
  }

  if (fromStoreId && typeof fromStoreId === 'string') {
    filters.fromStore = new Types.ObjectId(fromStoreId);
  }

  if (toStoreId && typeof toStoreId === 'string') {
    filters.toStore = new Types.ObjectId(toStoreId);
  }

  const query = StockTransfer.find(filters)
    .populate('fromStore', 'name code country')
    .populate('toStore', 'name code country')
    .populate('product', 'name code')
    .populate('requestedBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [transfers, total] = await Promise.all([query.exec(), StockTransfer.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, transfers, buildPaginationMeta(page, limit, total));
});

export const createStockTransfer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { fromStoreId, toStoreId, productId, quantity, notes } = req.body as {
    fromStoreId?: string;
    toStoreId?: string;
    productId?: string;
    quantity?: number;
    notes?: string;
  };

  if (!fromStoreId || !toStoreId || !productId) {
    throw ApiError.badRequest('fromStoreId, toStoreId and productId are required');
  }

  if (fromStoreId === toStoreId) {
    throw ApiError.badRequest('From store and to store cannot be the same');
  }

  if (typeof quantity !== 'number' || quantity <= 0) {
    throw ApiError.badRequest('Quantity must be a positive number');
  }

  const [fromStore, toStore] = await Promise.all([Store.findById(fromStoreId), Store.findById(toStoreId)]);

  if (!fromStore || !fromStore.isActive) {
    throw ApiError.notFound('From store not found or inactive');
  }

  if (!toStore || !toStore.isActive) {
    throw ApiError.notFound('To store not found or inactive');
  }

  if (!isIndianStore(fromStore.country)) {
    throw ApiError.badRequest('Stock transfer can only be requested from Indian stores');
  }

  const sourceStock = await StoreStock.findOne({
    store: new Types.ObjectId(fromStoreId),
    product: new Types.ObjectId(productId)
  });

  if (!sourceStock) {
    throw ApiError.badRequest('Selected item stock not found in source store');
  }

  if (sourceStock.quantity < quantity) {
    throw ApiError.badRequest(`Insufficient stock. Available: ${sourceStock.quantity}, Requested: ${quantity}`);
  }

  const transfer = await StockTransfer.create({
    fromStore: new Types.ObjectId(fromStoreId),
    toStore: new Types.ObjectId(toStoreId),
    product: new Types.ObjectId(productId),
    quantity,
    status: 'pending',
    notes,
    requestedBy: new Types.ObjectId(req.user.id)
  });

  const populatedTransfer = await StockTransfer.findById(transfer._id)
    .populate('fromStore', 'name code country')
    .populate('toStore', 'name code country')
    .populate('product', 'name code')
    .populate('requestedBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  return respond(res, StatusCodes.CREATED, populatedTransfer, { message: 'Stock transfer created with pending status' });
});

export const approveStockTransfer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }
  const currentUserId = req.user.id;

  const session = await mongoose.startSession();

  try {
    let approvedTransferId: Types.ObjectId | null = null;

    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findById(req.params.id).session(session);

      if (!transfer) {
        throw ApiError.notFound('Stock transfer not found');
      }

      if (transfer.status !== 'pending') {
        throw ApiError.badRequest(`Only pending transfers can be approved. Current status: ${transfer.status}`);
      }

      const sourceStock = await StoreStock.findOne({
        store: transfer.fromStore,
        product: transfer.product
      }).session(session);

      if (!sourceStock) {
        throw ApiError.badRequest('Source stock not found');
      }

      if (sourceStock.quantity < transfer.quantity) {
        throw ApiError.badRequest(`Insufficient stock at approval time. Available: ${sourceStock.quantity}, Requested: ${transfer.quantity}`);
      }

      sourceStock.quantity -= transfer.quantity;
      sourceStock.lastUpdatedBy = new Types.ObjectId(currentUserId);
      await sourceStock.save({ session });

      await StoreStock.updateOne(
        {
          store: transfer.toStore,
          product: transfer.product
        },
        {
          $inc: { quantity: transfer.quantity },
          $set: {
            margin: sourceStock.margin ?? 0,
            currency: sourceStock.currency ?? 'INR',
            unitPrice: sourceStock.unitPrice ?? 0,
            unitPriceAED: sourceStock.unitPriceAED ?? 0,
            dpPrice: sourceStock.dpPrice,
            exchangeRate: sourceStock.exchangeRate,
            finalPrice: sourceStock.finalPrice,
            lastUpdatedBy: new Types.ObjectId(currentUserId)
          },
          $setOnInsert: {
            store: transfer.toStore,
            product: transfer.product
          }
        },
        { upsert: true, session }
      );

      transfer.status = 'approved';
      transfer.approvedBy = new Types.ObjectId(currentUserId);
      transfer.approvedAt = new Date();
      await transfer.save({ session });
      approvedTransferId = transfer._id as Types.ObjectId;
    });

    if (!approvedTransferId) {
      throw ApiError.badRequest('Unable to approve transfer');
    }

    const approvedTransfer = await StockTransfer.findById(approvedTransferId)
      .populate('fromStore', 'name code country')
      .populate('toStore', 'name code country')
      .populate('product', 'name code')
      .populate('requestedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    return respond(res, StatusCodes.OK, approvedTransfer, { message: 'Stock transfer approved and stock moved successfully' });
  } finally {
    await session.endSession();
  }
});
