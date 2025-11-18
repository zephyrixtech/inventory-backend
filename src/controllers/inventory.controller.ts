import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Inventory } from '../models/inventory.model';
import { Item } from '../models/item.model';
import { Store } from '../models/store.model';
import { PurchaseOrder } from '../models/purchase-order.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listInventory = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { storeId, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {
    company: companyId
  };

  if (storeId && storeId !== 'all') {
    filters.store = storeId;
  }

  if (search && typeof search === 'string') {
    const matchingItems = await Item.find({
      company: companyId,
      $or: [{ name: new RegExp(search, 'i') }, { code: new RegExp(search, 'i') }]
    }).select('_id');

    filters.item = { $in: matchingItems.map((item) => item._id) };
  }

  const query = Inventory.find(filters)
    .populate('item')
    .populate('store')
    .populate('purchaseOrder', 'poNumber status');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ updatedAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [inventory, total] = await Promise.all([query.exec(), Inventory.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, inventory, buildPaginationMeta(page, limit, total));
});

export const createInventoryRecord = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { itemId, storeId, quantity, unitPrice, sellingPrice, stockDate, expiryDate, purchaseOrderId, notes } = req.body;

  const [item, store, purchaseOrder] = await Promise.all([
    Item.findOne({ _id: itemId, company: companyId }),
    Store.findOne({ _id: storeId, company: companyId }),
    purchaseOrderId ? PurchaseOrder.findOne({ _id: purchaseOrderId, company: companyId }) : null
  ]);

  if (!item) {
    throw ApiError.badRequest('Invalid item');
  }
  if (!store) {
    throw ApiError.badRequest('Invalid store');
  }

  const existingRecord = await Inventory.findOne({
    company: companyId,
    item: item._id,
    store: store._id
  });

  if (existingRecord) {
    existingRecord.quantity += Number(quantity);
    if (unitPrice) existingRecord.unitPrice = unitPrice;
    if (sellingPrice) existingRecord.sellingPrice = sellingPrice;
    if (stockDate) existingRecord.stockDate = stockDate;
    if (expiryDate) existingRecord.expiryDate = expiryDate;
    if (purchaseOrder) existingRecord.purchaseOrder = purchaseOrder._id;
    if (notes) existingRecord.notes = notes;
    await existingRecord.save();

    return respond(res, StatusCodes.OK, existingRecord, { message: 'Inventory updated successfully' });
  }

  const inventory = await Inventory.create({
    company: companyId,
    item: item._id,
    store: store._id,
    quantity,
    unitPrice,
    sellingPrice,
    stockDate,
    expiryDate,
    purchaseOrder: purchaseOrder?._id,
    notes
  });

  return respond(res, StatusCodes.CREATED, inventory, { message: 'Inventory record created successfully' });
});

export const updateInventoryRecord = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const inventory = await Inventory.findOne({ _id: req.params.id, company: companyId });

  if (!inventory) {
    throw ApiError.notFound('Inventory record not found');
  }

  const { quantity, unitPrice, sellingPrice, stockDate, expiryDate, notes } = req.body;

  if (typeof quantity === 'number') inventory.quantity = quantity;
  if (typeof unitPrice === 'number') inventory.unitPrice = unitPrice;
  if (typeof sellingPrice === 'number') inventory.sellingPrice = sellingPrice;
  if (stockDate) inventory.stockDate = stockDate;
  if (expiryDate) inventory.expiryDate = expiryDate;
  if (notes) inventory.notes = notes;

  await inventory.save();

  return respond(res, StatusCodes.OK, inventory, { message: 'Inventory record updated successfully' });
});

export const deleteInventoryRecord = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const inventory = await Inventory.findOne({ _id: req.params.id, company: companyId });

  if (!inventory) {
    throw ApiError.notFound('Inventory record not found');
  }

  await inventory.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Inventory record deleted successfully' });
});

