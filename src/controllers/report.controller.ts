import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { PurchaseOrder } from '../models/purchase-order.model';
import { StoreStock } from '../models/store-stock.model';
import { SalesInvoice } from '../models/sales-invoice.model';
import { DailyExpense } from '../models/daily-expense.model';
import { PackingList } from '../models/packing-list.model';
import { Vendor } from '../models/vendor.model';
import { Item } from '../models/item.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

const buildUtcDayRange = (from?: unknown, to?: unknown): Record<string, Date> | null => {
  const range: Record<string, Date> = {};
  if (typeof from === 'string' && from) {
    const fromDate = new Date(from);
    fromDate.setUTCHours(0, 0, 0, 0);
    range.$gte = fromDate;
  }
  if (typeof to === 'string' && to) {
    const toDate = new Date(to);
    toDate.setUTCHours(23, 59, 59, 999);
    range.$lte = toDate;
  }
  return Object.keys(range).length > 0 ? range : null;
};

export const getPurchaseReport = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { from, to } = req.query;

  // Removed company context - using empty filters object
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.orderDate = {};
    if (from) {
      (filters.orderDate as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.orderDate as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  const purchaseOrders = await PurchaseOrder.find(filters)
    .populate('supplier', 'name')
    .populate('items.item', 'name code')
    .sort({ orderDate: -1 });

  return respond(res, StatusCodes.OK, purchaseOrders);
});

export const getStockReport = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const stock = await StoreStock.find().populate('product', 'name code quantity unitPrice currency status');

  return respond(res, StatusCodes.OK, stock);
});

export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { customerId } = req.query;

  // Removed company context - using empty filters object
  const filters: Record<string, unknown> = {};

  if (customerId) {
    filters.customer = customerId;
  }

  const invoices = await SalesInvoice.find(filters)
    .populate('customer', 'name')
    .populate('items.item', 'name code')
    .sort({ invoiceDate: -1 });

  return respond(res, StatusCodes.OK, invoices);
});

export const getExpenseReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;

  const filters: Record<string, unknown> = {};
  const dateRange = buildUtcDayRange(from, to);
  if (dateRange) {
    filters.date = dateRange;
  }

  const expenses = await DailyExpense.find(filters)
    .populate('supplier', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort({ date: -1, createdAt: -1 });

  return respond(res, StatusCodes.OK, expenses);
});

export const getCreditNotesReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;

  const creditContentFilter: Record<string, unknown> = {
    $or: [{ creditReport: /\S/ }, { credit_report: /\S/ }]
  };

  const dateRange = buildUtcDayRange(from, to);

  const filters: Record<string, unknown> = dateRange
    ? {
        $and: [
          creditContentFilter,
          {
            $or: [{ updatedAt: dateRange }, { createdAt: dateRange }]
          }
        ]
      }
    : creditContentFilter;

  const creditNotes = await Vendor.find(filters)
    .populate('createdBy', 'firstName lastName')
    .sort({ updatedAt: -1 });

  return respond(res, StatusCodes.OK, creditNotes);
});

export const getPackingListReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;

  // Build date filters
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.createdAt = {};
    if (from) {
      (filters.createdAt as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.createdAt as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  const packingLists = await PackingList.find(filters)
    .populate('items.product', 'name code description')
    .populate('store', 'name')
    .populate('toStore', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  console.log('Packing lists found:', packingLists.length);
  if (packingLists.length > 0) {
    console.log('Sample packing list:', JSON.stringify(packingLists[0], null, 2));
  }

  return respond(res, StatusCodes.OK, packingLists);
});

export const getItemReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, itemIds } = req.query;

  if (typeof itemIds !== 'string' || !itemIds.trim()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'itemIds is required (comma-separated Mongo IDs)');
  }

  const rawIds = itemIds
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const rawIdSet = new Set(rawIds);

  const invalidIds = rawIds.filter((id) => !Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid itemIds: ${invalidIds.join(', ')}`);
  }

  const objectIds = rawIds.map((id) => new Types.ObjectId(id));

  const itemDateRange = buildUtcDayRange(from, to);

  const [items, packingLists, salesInvoices] = await Promise.all([
    Item.find({ _id: { $in: objectIds } })
      .populate('vendor', 'name')
      .sort({ createdAt: -1 })
      .lean(),
    PackingList.find({
      ...(itemDateRange ? { createdAt: itemDateRange } : {}),
      'items.product': { $in: objectIds }
    })
      .sort({ createdAt: -1 })
      .lean(),
    SalesInvoice.find({
      ...(itemDateRange ? { invoiceDate: itemDateRange } : {}),
      'items.item': { $in: objectIds }
    })
      .populate('customer', 'name')
      .sort({ invoiceDate: -1 })
      .lean()
  ]);

  const packingByItem = new Map<
    string,
    { details: string[]; cargoNumbers: Set<string>; shipmentDates: Set<string> }
  >();

  for (const packingList of packingLists as any[]) {
    const cargoNumber = (packingList as any).cargoNumber;
    const shipmentDate = (packingList as any).shipmentDate
      ? new Date((packingList as any).shipmentDate).toISOString()
      : null;

    for (const plItem of (packingList.items || []) as any[]) {
      const productId = String(plItem.product);
      if (!rawIdSet.has(productId)) continue;

      const boxNumber = (packingList as any).boxNumber || '';
      const size = (packingList as any).size ? ` (${(packingList as any).size})` : '';
      const remark = (packingList as any).description ? ` - ${(packingList as any).description}` : '';
      const qty = typeof plItem.quantity === 'number' ? plItem.quantity : 0;

      const detail = `Box ${boxNumber}${size}${remark} • Qty ${qty}`;

      const entry =
        packingByItem.get(productId) ||
        { details: [], cargoNumbers: new Set<string>(), shipmentDates: new Set<string>() };
      entry.details.push(detail);
      if (typeof cargoNumber === 'string' && cargoNumber.trim()) entry.cargoNumbers.add(cargoNumber.trim());
      if (shipmentDate) entry.shipmentDates.add(shipmentDate);
      packingByItem.set(productId, entry);
    }
  }

  const customersByItem = new Map<string, Set<string>>();
  for (const invoice of salesInvoices as any[]) {
    const customerName =
      (invoice as any)?.customer?.name || (invoice as any)?.customerName || (invoice as any)?.customer_name;

    for (const invItem of (invoice.items || []) as any[]) {
      const itemId = String(invItem.item);
      if (!rawIdSet.has(itemId)) continue;

      const set = customersByItem.get(itemId) || new Set<string>();
      if (typeof customerName === 'string' && customerName.trim()) set.add(customerName.trim());
      customersByItem.set(itemId, set);
    }
  }

  const rows = (items as any[]).map((item) => {
    const id = String(item._id);
    const packing = packingByItem.get(id);
    const customers = customersByItem.get(id);

    const itemDate = item.purchaseDate || item.createdAt;
    const latestShipmentDate = packing?.shipmentDates?.size
      ? Array.from(packing.shipmentDates).sort().slice(-1)[0]
      : null;

    return {
      itemId: id,
      itemName: item.name || item.code || 'Unknown Item',
      itemDate: itemDate ? new Date(itemDate).toISOString() : null,
      supplierName: (item.vendor as any)?.name || null,
      packingListDetails: packing?.details?.length ? packing.details.join('; ') : null,
      cargoNumber: packing?.cargoNumbers?.size ? Array.from(packing.cargoNumbers).join(', ') : null,
      shipmentDate: latestShipmentDate,
      customerName: customers?.size ? Array.from(customers).join(', ') : null
    };
  });

  return respond(res, StatusCodes.OK, rows);
});
