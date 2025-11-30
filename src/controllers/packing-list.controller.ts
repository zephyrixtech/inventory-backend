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
  companyId: NonNullable<Request['companyId']>,
  items: Array<{ productId: string; quantity: number }>
) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Packing list items are required');
  }

  const normalized: Array<{ product: Types.ObjectId; quantity: number }> = [];

  for (const entry of items) {
    const product = await Item.findOne({ _id: entry.productId, company: companyId });
    if (!product) {
      throw ApiError.badRequest(`Invalid product: ${entry.productId}`);
    }

    normalized.push({
      product: product._id,
      quantity: entry.quantity
    });

    if (product.status === 'store_pending') {
      product.status = 'store_pending';
      await product.save();
    }
  }

  return normalized;
};

export const listPackingLists = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = { company: companyId };

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (search && typeof search === 'string') {
    filters.$or = [{ boxNumber: new RegExp(search, 'i') }, { location: new RegExp(search, 'i') }];
  }

  const query = PackingList.find(filters)
    .populate('items.product', 'name code status')
    .populate('createdBy', 'firstName lastName');

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
  const companyId = req.companyId;
  if (!companyId || !req.user) {
    throw ApiError.badRequest('Company context missing');
  }

  const { location, boxNumber, items, shipmentDate, packingDate, image, storeId } = req.body;

  const existing = await PackingList.findOne({ company: companyId, boxNumber });
  if (existing) {
    throw ApiError.conflict('Packing list with this box number already exists');
  }

  if (!storeId) {
    throw ApiError.badRequest('Store ID is required');
  }

  const normalizedItems = await normalizeItems(companyId, items ?? []);

  // Reduce store stock quantities
  for (const item of normalizedItems) {
    const stock = await StoreStock.findOne({
      company: companyId,
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
    company: companyId,
    location,
    boxNumber,
    items: normalizedItems,
    shipmentDate,
    packingDate,
    image,
    status: 'pending',
    createdBy: new Types.ObjectId(req.user.id)
  });

  return respond(res, StatusCodes.CREATED, packingList, { message: 'Packing list created successfully' });
});

export const getPackingList = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const packingList = await PackingList.findOne({ _id: req.params.id, company: companyId })
    .populate('items.product', 'name code status')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  return respond(res, StatusCodes.OK, packingList);
});

export const updatePackingList = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const packingList = await PackingList.findOne({ _id: req.params.id, company: companyId });

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  const { location, items, shipmentDate, packingDate, status, image, storeId } = req.body;

  if (location) packingList.location = location;
  if (shipmentDate) packingList.shipmentDate = shipmentDate;
  if (packingDate) packingList.packingDate = packingDate;
  if (image) packingList.image = image;

  if (Array.isArray(items)) {
    const newItems = await normalizeItems(companyId, items);

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
            company: companyId,
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
            company: companyId,
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

  if (status && ['pending', 'approved', 'shipped', 'rejected'].includes(status)) {
    packingList.status = status;
    if (['approved', 'shipped'].includes(status) && req.user) {
      packingList.approvedBy = new Types.ObjectId(req.user.id);
      packingList.approvedAt = new Date();
    }
  }

  await packingList.save();

  // Populate the response with product information
  const updatedPackingList = await PackingList.findById(packingList._id)
    .populate('items.product', 'name code status')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  return respond(res, StatusCodes.OK, updatedPackingList, { message: 'Packing list updated successfully' });
});

export const deletePackingList = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const packingList = await PackingList.findOne({ _id: req.params.id, company: companyId });

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  // Restore store stock quantities when deleting
  // Note: This assumes we can identify the store from the packing list
  // If storeId is not stored in packing list, we may need to track it differently
  // For now, we'll just delete the packing list
  await packingList.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Packing list deleted successfully' });
});

