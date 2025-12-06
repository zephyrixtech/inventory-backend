import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { SalesInvoice } from '../models/sales-invoice.model';
import { Customer } from '../models/customer.model';
import { Store } from '../models/store.model';
import { Item } from '../models/item.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

type NormalizedInvoiceItem = {
  item: Types.ObjectId;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
};

const normalizeInvoiceItems = async (
  // Removed company context - changed parameter type
  items: Array<{ itemId: string; description?: string; quantity: number; unitPrice: number; discount?: number }>
) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('At least one invoice item is required');
  }

  const normalized: NormalizedInvoiceItem[] = [];

  for (const entry of items) {
    // Removed company filter since we're removing company context
    const item = await Item.findById(entry.itemId);
    if (!item) {
      throw ApiError.badRequest(`Invalid item: ${entry.itemId}`);
    }

    // Convert discount percentage to actual discount amount
    const discountPercentage = entry.discount ?? 0;
    const grossAmount = entry.quantity * entry.unitPrice;
    const discountAmount = (grossAmount * discountPercentage) / 100;
    const totalPrice = grossAmount - discountAmount;

    normalized.push({
      item: item._id,
      description: entry.description ?? item.name,
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      discount: discountAmount, 
      totalPrice
    });
  }

  return normalized;
};

export const listSalesInvoices = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  const { customerId, dateFrom, dateTo, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  // Removed company context - using empty filters object
  const filters: Record<string, unknown> = {};

  if (customerId && customerId !== 'all') {
    filters.customer = customerId;
  }

  if (search && typeof search === 'string') {
    filters.invoiceNumber = new RegExp(search, 'i');
  }

  if (dateFrom || dateTo) {
    const invoiceDateFilter: Record<string, Date> = {};
    if (dateFrom) {
      invoiceDateFilter.$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      invoiceDateFilter.$lte = new Date(dateTo as string);
    }
    filters.invoiceDate = invoiceDateFilter;
  }

  const query = SalesInvoice.find(filters)
    .populate('customer', 'name customerId')
    .populate('store', 'name code');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ invoiceDate: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [invoices, total] = await Promise.all([query.exec(), SalesInvoice.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, invoices, buildPaginationMeta(page, limit, total));
});

export const getSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const invoice = await SalesInvoice.findById(req.params.id)
    .populate('customer', 'name email phone')
    .populate('store', 'name code')
    .populate('items.item', 'name code');

  if (!invoice) {
    throw ApiError.notFound('Sales invoice not found');
  }

  return respond(res, StatusCodes.OK, invoice);
});

export const createSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { invoiceNumber, invoiceDate, customerId, storeId, items, taxAmount = 0, notes } = req.body;

  // Removed company filter since we're removing company context
  const existing = await SalesInvoice.findOne({ invoiceNumber });
  if (existing) {
    throw ApiError.conflict('Invoice number already exists');
  }

  // Removed company filter since we're removing company context
  const [customer, store] = await Promise.all([
    Customer.findById(customerId),
    Store.findOne({ _id: storeId, isActive: true })
  ]);

  if (!customer) {
    throw ApiError.badRequest('Invalid customer');
  }

  if (!store) {
    throw ApiError.badRequest('Invalid store');
  }

  // Removed company parameter since we're removing company context
  const normalizedItems = await normalizeInvoiceItems(items);

  const subTotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountTotal = normalizedItems.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const netAmount = subTotal - discountTotal + taxAmount;

  const invoice = await SalesInvoice.create({
    // Removed company field since we're removing company context
    invoiceNumber,
    invoiceDate,
    customer: customer._id,
    store: store._id,
    subTotal,
    discountTotal,
    netAmount,
    taxAmount,
    notes,
    createdBy: req.user ? new Types.ObjectId(req.user.id) : undefined,
    items: normalizedItems
  });

  return respond(res, StatusCodes.CREATED, invoice, { message: 'Sales invoice created successfully' });
});

export const updateSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const invoice = await SalesInvoice.findById(req.params.id);

  if (!invoice) {
    throw ApiError.notFound('Sales invoice not found');
  }

  const { invoiceDate, items, taxAmount, notes } = req.body;

  if (invoiceDate) invoice.invoiceDate = invoiceDate;
  if (typeof taxAmount === 'number') invoice.taxAmount = taxAmount;
  if (notes) invoice.notes = notes;

  if (Array.isArray(items)) {
    // Removed company parameter since we're removing company context
    const normalizedItems = await normalizeInvoiceItems(items);
    const subTotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discountTotal = normalizedItems.reduce((sum, item) => sum + (item.discount ?? 0), 0);
    invoice.items = normalizedItems;
    invoice.subTotal = subTotal;
    invoice.discountTotal = discountTotal;
    invoice.netAmount = subTotal - discountTotal + (invoice.taxAmount ?? 0);
  }

  await invoice.save();

  return respond(res, StatusCodes.OK, invoice, { message: 'Sales invoice updated successfully' });
});

export const deleteSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const invoice = await SalesInvoice.findById(req.params.id);

  if (!invoice) {
    throw ApiError.notFound('Sales invoice not found');
  }

  await invoice.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Sales invoice deleted successfully' });
});