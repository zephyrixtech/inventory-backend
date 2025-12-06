import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { PurchaseOrder } from '../models/purchase-order.model';
import { Supplier } from '../models/supplier.model';
import { Item } from '../models/item.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

type NormalizedPurchaseOrderItem = {
  item: Types.ObjectId;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
};

const normalizeItems = async (
  // Removed company context - changed parameter type
  items: Array<{ itemId: string; description?: string; quantity: number; unitPrice: number }>
) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('At least one item is required');
  }

  const normalized: NormalizedPurchaseOrderItem[] = [];

  for (const entry of items) {
    // Removed company filter since we're removing company context
    const item = await Item.findById(entry.itemId);
    if (!item) {
      throw ApiError.badRequest(`Invalid item: ${entry.itemId}`);
    }
    const totalPrice = entry.quantity * entry.unitPrice;
    normalized.push({
      item: item._id,
      description: entry.description ?? item.name,
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      totalPrice,
      receivedQuantity: 0
    });
  }

  return normalized;
};

export const listPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { status, supplierId, search, dateFrom, dateTo } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  // Removed company context - using empty filters object
  const filters: Record<string, unknown> = {
    isActive: true
  };

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (supplierId && supplierId !== 'all') {
    filters.supplier = supplierId;
  }

  if (search && typeof search === 'string') {
    filters.poNumber = new RegExp(search, 'i');
  }

  if (dateFrom || dateTo) {
    const orderDateFilter: Record<string, Date> = {};
    if (dateFrom) {
      orderDateFilter.$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      orderDateFilter.$lte = new Date(dateTo as string);
    }
    filters.orderDate = orderDateFilter;
  }

  const query = PurchaseOrder.find(filters)
    .populate('supplier', 'name supplierId')
    .populate('issuedBy', 'firstName lastName email');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [orders, total] = await Promise.all([query.exec(), PurchaseOrder.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, orders, buildPaginationMeta(page, limit, total));
});

export const getPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const order = await PurchaseOrder.findById(req.params.id)
    .populate('supplier', 'name email phone')
    .populate('items.item', 'name code')
    .populate('issuedBy', 'firstName lastName');

  if (!order) {
    throw ApiError.notFound('Purchase order not found');
  }

  return respond(res, StatusCodes.OK, order);
});

export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { poNumber, supplierId, orderDate, expectedDate, status, items, notes } = req.body;

  // Removed company filter since we're removing company context
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) {
    throw ApiError.badRequest('Invalid supplier');
  }

  // Removed company filter since we're removing company context
  const existing = await PurchaseOrder.findOne({ poNumber });
  if (existing) {
    throw ApiError.conflict('Purchase order number already exists');
  }

  // Removed company parameter since we're removing company context
  const normalizedItems = await normalizeItems(items);

  const totalValue = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const order = await PurchaseOrder.create({
    // Removed company field since we're removing company context
    poNumber,
    supplier: supplier._id,
    orderDate,
    expectedDate,
    status,
    totalValue,
    notes,
    issuedBy: req.user ? new Types.ObjectId(req.user.id) : undefined,
    items: normalizedItems,
    isActive: true
  });

  return respond(res, StatusCodes.CREATED, order, { message: 'Purchase order created successfully' });
});

export const updatePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const order = await PurchaseOrder.findById(req.params.id);

  if (!order) {
    throw ApiError.notFound('Purchase order not found');
  }

  const { status, expectedDate, notes, items } = req.body;

  if (status) order.status = status;
  if (expectedDate) order.expectedDate = expectedDate;
  if (notes) order.notes = notes;

  if (Array.isArray(items)) {
    // Removed company parameter since we're removing company context
    const normalizedItems = await normalizeItems(items);
    order.items = normalizedItems;
    order.totalValue = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  await order.save();

  return respond(res, StatusCodes.OK, order, { message: 'Purchase order updated successfully' });
});

export const deletePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const order = await PurchaseOrder.findById(req.params.id);

  if (!order) {
    throw ApiError.notFound('Purchase order not found');
  }

  order.isActive = false;
  await order.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Purchase order archived successfully' });
});