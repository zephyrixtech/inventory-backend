import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { PackingList } from '../models/packing-list.model';
import { Item } from '../models/item.model';
import { StoreStock } from '../models/store-stock.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

const normalizeItems = async (
  items: Array<{ productId: string; quantity: number; description?: string; unitOfMeasure?: string }>
) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Packing list items are required');
  }

  const normalized: Array<{ product: Types.ObjectId; quantity: number; description?: string; unitOfMeasure?: string }> = [];

  for (const entry of items) {
    const product = await Item.findById(entry.productId);
    if (!product) {
      throw ApiError.badRequest(`Invalid product: ${entry.productId}`);
    }

    normalized.push({
      product: product._id,
      quantity: entry.quantity,
      description: entry.description,
      unitOfMeasure: entry.unitOfMeasure
    });

    if (product.status === 'store_pending') {
      product.status = 'store_pending';
      await product.save();
    }
  }

  return normalized;
};

export const listPackingLists = asyncHandler(async (req: Request, res: Response) => {

  const { status, approvalStatus, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (approvalStatus && approvalStatus !== 'all') {
    filters.approvalStatus = approvalStatus;
  }

  // Removed location search since we're removing location field
  if (search && typeof search === 'string') {
    filters.$or = [{ boxNumber: new RegExp(search, 'i') }];
  }

  const query = PackingList.find(filters)
    .populate('items.product', 'name code status')
    .populate('createdBy', 'firstName lastName')
    .populate('store', 'name code')
    .populate('toStore', 'name code');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [lists, total] = await Promise.all([query.exec(), PackingList.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, lists, buildPaginationMeta(page, limit, total));
});

export const createPackingList = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  // Removed location field since we're removing location field
  const { boxNumber, items, shipmentDate, packingDate, image1, image2, storeId, toStoreId, currency, exchangeRate, status, approvalStatus, cargoNumber, fabricDetails, size, description } = req.body;

  const existing = await PackingList.findOne({ boxNumber });
  if (existing) {
    throw ApiError.conflict('Packing list with this box number already exists');
  }

  if (!storeId) {
    throw ApiError.badRequest('Store ID is required');
  }

  if (toStoreId && storeId === toStoreId) {
    throw ApiError.badRequest('Source and destination stores cannot be the same');
  }

  const normalizedItems = await normalizeItems(items ?? []);

  // Reduce store stock quantities
  for (const item of normalizedItems) {
    const stock = await StoreStock.findOne({
      product: item.product,
      store: new Types.ObjectId(storeId)
    });

    if (!stock) {
      throw ApiError.badRequest(`Stock not found for product ${item.product} in selected store`);
    }

    if (stock.quantity < item.quantity) {
      throw ApiError.badRequest(
        `Insufficient stock for product. Available: ${stock.quantity}, Requested: ${item.quantity}`
      );
    }

    stock.quantity -= item.quantity;
    stock.lastUpdatedBy = new Types.ObjectId(req.user.id);
    await stock.save();
  }

  const packingList = await PackingList.create({
    // Removed location field since we're removing location field
    boxNumber,
    items: normalizedItems,
    shipmentDate,
    packingDate,
    image1,
    image2,
    store: new Types.ObjectId(storeId),
    toStore: toStoreId ? new Types.ObjectId(toStoreId) : undefined,
    currency: currency || 'INR',
    exchangeRate,
    status: status || 'india',
    approvalStatus: approvalStatus || 'draft', // Default to draft
    createdBy: new Types.ObjectId(req.user.id),
    // New fields
    cargoNumber,
    fabricDetails,
    size,
    description
  });

  return respond(res, StatusCodes.CREATED, packingList, { message: 'Packing list created successfully' });
});

export const getPackingList = asyncHandler(async (req: Request, res: Response) => {

  const packingList = await PackingList.findById(req.params.id)
    .populate('items.product', 'name code status')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName')
    .populate('store', 'name code')
    .populate('toStore', 'name code');

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  return respond(res, StatusCodes.OK, packingList);
});

export const updatePackingList = asyncHandler(async (req: Request, res: Response) => {

  const packingList = await PackingList.findById(req.params.id);

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  // Removed location field since we're removing location field
  const { boxNumber, items, shipmentDate, packingDate, status, approvalStatus, image1, image2, storeId, toStoreId, currency, exchangeRate, cargoNumber, fabricDetails, size, description } = req.body;

  if (boxNumber && boxNumber !== packingList.boxNumber) {
    const existing = await PackingList.findOne({ boxNumber });
    if (existing) {
      throw ApiError.conflict('Packing list with this box number already exists');
    }
    packingList.boxNumber = boxNumber;
  }

  // Removed location update since we're removing location field
  if (shipmentDate) packingList.shipmentDate = shipmentDate;
  if (packingDate) packingList.packingDate = packingDate;
  if (image1 !== undefined) packingList.image1 = image1;
  if (image2 !== undefined) packingList.image2 = image2;
  if (toStoreId) packingList.toStore = new Types.ObjectId(toStoreId);
  if (currency) packingList.currency = currency;
  if (exchangeRate) packingList.exchangeRate = exchangeRate;
  // New fields
  if (cargoNumber !== undefined) packingList.cargoNumber = cargoNumber;
  if (fabricDetails !== undefined) packingList.fabricDetails = fabricDetails;
  if (size !== undefined) packingList.size = size;
  if (description !== undefined) packingList.description = description;

  if (Array.isArray(items)) {
    const newItems = await normalizeItems(items);

    if (storeId) {
      // Create a map of old items for easy lookup
      const oldItemsMap = new Map<string, number>();
      packingList.items.forEach((item) => {
        oldItemsMap.set(item.product.toString(), item.quantity);
      });

      const processedProductIds = new Set<string>();

      // Process new items
      for (const newItem of newItems) {
        const productId = newItem.product.toString();
        processedProductIds.add(productId);
        const oldQty = oldItemsMap.get(productId) || 0;
        const diff = newItem.quantity - oldQty;

        if (diff !== 0) {
          const stock = await StoreStock.findOne({
            product: newItem.product,
            store: new Types.ObjectId(storeId)
          });

          if (!stock) {
            throw ApiError.badRequest(`Stock not found for product in selected store`);
          }

          // If diff > 0, we are consuming more stock (decreasing stock)
          // If diff < 0, we are releasing stock (increasing stock)
          if (diff > 0 && stock.quantity < diff) {
            throw ApiError.badRequest(
              `Insufficient stock for product. Available: ${stock.quantity}, Additional Needed: ${diff}`
            );
          }

          stock.quantity -= diff;
          if (req.user) {
            stock.lastUpdatedBy = new Types.ObjectId(req.user.id);
          }
          await stock.save();
        }
      }

      // Handle removed items (add quantity back to stock)
      for (const [productId, oldQty] of oldItemsMap) {
        if (!processedProductIds.has(productId)) {
          const stock = await StoreStock.findOne({
            product: new Types.ObjectId(productId),
            store: new Types.ObjectId(storeId)
          });

          if (stock) {
            stock.quantity += oldQty;
            if (req.user) {
              stock.lastUpdatedBy = new Types.ObjectId(req.user.id);
            }
            await stock.save();
          }
        }
      }
    }

    packingList.items = newItems;
  }

  // Handle approval status changes
  if (approvalStatus && ['draft', 'approved'].includes(approvalStatus)) {
    // Check if approval status is changing to approved
    if (approvalStatus === 'approved' && packingList.approvalStatus !== 'approved') {
      // Set approval metadata
      if (req.user) {
        packingList.approvedBy = new Types.ObjectId(req.user.id);
        packingList.approvedAt = new Date();
      }
    }

    packingList.approvalStatus = approvalStatus;
  }

  // Handle regular status changes (separate from approval workflow)
  if (status && ['pending', 'in_transit', 'approved', 'shipped', 'rejected', 'india', 'uae'].includes(status)) {
    packingList.status = status;
  }

  await packingList.save();

  // Populate the response with product information
  const updatedPackingList = await PackingList.findById(packingList._id)
    .populate('items.product', 'name code status')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName')
    .populate('toStore', 'name code');

  return respond(res, StatusCodes.OK, updatedPackingList);
});

export const approvePackingList = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const packingList = await PackingList.findById(req.params.id);

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  if (packingList.approvalStatus === 'approved') {
    throw ApiError.badRequest('Packing list is already approved');
  }

  // Update approval status
  packingList.approvalStatus = 'approved';
  packingList.approvedBy = new Types.ObjectId(req.user.id);
  packingList.approvedAt = new Date();
  await packingList.save();

  // Populate the response with product information
  const updatedPackingList = await PackingList.findById(packingList._id)
    .populate('items.product', 'name code status')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName')
    .populate('store', 'name code')
    .populate('toStore', 'name code');

  return respond(res, StatusCodes.OK, updatedPackingList, { message: 'Packing list approved successfully' });
});

export const deletePackingList = asyncHandler(async (req: Request, res: Response) => {

  const packingList = await PackingList.findById(req.params.id);

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  // Only allow deletion of draft packing lists
  if (packingList.approvalStatus === 'approved') {
    throw ApiError.badRequest('Cannot delete approved packing lists');
  }

  // Restore store stock quantities when deleting (add back to source store)
  if (packingList.store) {
    for (const item of packingList.items) {
      const stock = await StoreStock.findOne({
        product: item.product,
        store: packingList.store
      });

      if (stock) {
        stock.quantity += item.quantity;
        if (req.user) {
          stock.lastUpdatedBy = new Types.ObjectId(req.user.id);
        }
        await stock.save();
      }
    }
  }

  await packingList.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Packing list deleted successfully and stock restored' });
});