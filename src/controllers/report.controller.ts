import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { PurchaseOrder } from '../models/purchase-order.model';
import { StoreStock } from '../models/store-stock.model';
import { SalesInvoice } from '../models/sales-invoice.model';
import { DailyExpense } from '../models/daily-expense.model';
import { PackingList } from '../models/packing-list.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

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
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const expenses = await DailyExpense.find().populate('product', 'name code');

  return respond(res, StatusCodes.OK, expenses);
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