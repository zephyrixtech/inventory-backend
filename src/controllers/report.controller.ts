import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { PurchaseOrder } from '../models/purchase-order.model';
import { StoreStock } from '../models/store-stock.model';
import { SalesInvoice } from '../models/sales-invoice.model';
import { DailyExpense } from '../models/daily-expense.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const getPurchaseReport = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { from, to } = req.query;

  const filters: Record<string, unknown> = { company: companyId };

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
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const stock = await StoreStock.find({ company: companyId }).populate('product', 'name code quantity unitPrice currency status');

  return respond(res, StatusCodes.OK, stock);
});

export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { customerId } = req.query;

  const filters: Record<string, unknown> = { company: companyId };

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
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const expenses = await DailyExpense.find({ company: companyId }).populate('product', 'name code');

  return respond(res, StatusCodes.OK, expenses);
});

