import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PurchaseEntry, type PurchaseEntryDocument } from '../models/purchase-entry.model';
import { Item } from '../models/item.model';
import { Supplier } from '../models/supplier.model';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

// Generate purchase code
const generatePurchaseCode = async (): Promise<string> => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  
  const prefix = `PE${year}${month}${day}`;
  
  // Find the last purchase entry for today
  const lastEntry = await PurchaseEntry.findOne({
    purchaseCode: { $regex: `^${prefix}` }
  }).sort({ purchaseCode: -1 });
  
  let sequence = 1;
  if (lastEntry) {
    const lastSequence = parseInt(lastEntry.purchaseCode.slice(-3));
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${sequence.toString().padStart(3, '0')}`;
};

// Create purchase entry
export const createPurchaseEntry = asyncHandler(async (req: Request, res: Response) => {
  const { billNumber, date, supplier, items, totalAmount, discount = 0, paidAmount = 0, notes } = req.body;
  const userId = req.user?.id;

  if (!billNumber || !supplier || !items || !Array.isArray(items) || items.length === 0 || !totalAmount) {
    throw ApiError.badRequest('Bill number, supplier, at least one item, and total amount are required');
  }

  // Validate supplier exists
  const supplierDoc = await Supplier.findOne({ _id: supplier, isActive: true });
  if (!supplierDoc) {
    throw ApiError.notFound('Supplier not found');
  }

  // Validate items
  const validatedItems: any[] = [];

  for (const item of items) {
    if (!item.item) {
      throw ApiError.badRequest('Each item must have item ID');
    }

    // Validate item exists
    const itemDoc = await Item.findOne({ _id: item.item, isActive: true });
    if (!itemDoc) {
      throw ApiError.notFound(`Item with ID ${item.item} not found`);
    }

    validatedItems.push({
      item: item.item,
      description: item.description || itemDoc.description
    });
  }

  const finalAmount = totalAmount - discount;
  const balanceAmount = finalAmount - paidAmount;

  // Generate purchase code
  const purchaseCode = await generatePurchaseCode();

  const purchaseEntry = new PurchaseEntry({
    purchaseCode,
    billNumber,
    date: date ? new Date(date) : new Date(),
    supplier,
    items: validatedItems,
    totalAmount,
    discount,
    finalAmount,
    paidAmount,
    balanceAmount,
    notes,
    createdBy: userId
  });

  await purchaseEntry.save();

  // Populate the response
  await purchaseEntry.populate([
    { path: 'supplier', select: 'name email phone' },
    { path: 'items.item', select: 'name code description' },
    { path: 'createdBy', select: 'first_name last_name' }
  ]);

  return respond(res, StatusCodes.CREATED, purchaseEntry);
});

// Get all purchase entries
export const getPurchaseEntries = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = { isActive: true };

  if (search && typeof search === 'string') {
    filters.$or = [
      { purchaseCode: new RegExp(search, 'i') },
      { notes: new RegExp(search, 'i') }
    ];
  }

  const query = PurchaseEntry.find(filters).populate([
    { path: 'supplier', select: 'name email phone' },
    { path: 'items.item', select: 'name code description' },
    { path: 'createdBy', select: 'first_name last_name' }
  ]);

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [entries, total] = await Promise.all([
    query.exec(),
    PurchaseEntry.countDocuments(filters)
  ]);

  return respond(res, StatusCodes.OK, entries, buildPaginationMeta(page, limit, total));
});

// Get purchase entry by ID
export const getPurchaseEntryById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const purchaseEntry = await PurchaseEntry.findOne({
    _id: id,
    isActive: true
  }).populate([
    { path: 'supplier', select: 'name email phone contactPerson address' },
    { path: 'items.item', select: 'name code description unitPrice' },
    { path: 'createdBy', select: 'first_name last_name' }
  ]);

  if (!purchaseEntry) {
    throw ApiError.notFound('Purchase entry not found');
  }

  return respond(res, StatusCodes.OK, purchaseEntry);
});

// Update purchase entry
export const updatePurchaseEntry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { billNumber, date, supplier, items, totalAmount, discount = 0, paidAmount = 0, notes } = req.body;

  const purchaseEntry = await PurchaseEntry.findOne({
    _id: id,
    isActive: true
  });

  if (!purchaseEntry) {
    throw ApiError.notFound('Purchase entry not found');
  }

  // Validate supplier if provided
  if (supplier) {
    const supplierDoc = await Supplier.findOne({ _id: supplier, isActive: true });
    if (!supplierDoc) {
      throw ApiError.notFound('Supplier not found');
    }
    purchaseEntry.supplier = supplier;
  }

  // Update items if provided
  if (items && Array.isArray(items) && items.length > 0) {
    const validatedItems: any[] = [];

    for (const item of items) {
      if (!item.item) {
        throw ApiError.badRequest('Each item must have item ID');
      }

      // Validate item exists
      const itemDoc = await Item.findOne({ _id: item.item, isActive: true });
      if (!itemDoc) {
        throw ApiError.notFound(`Item with ID ${item.item} not found`);
      }

      validatedItems.push({
        item: item.item,
        description: item.description || itemDoc.description
      });
    }

    purchaseEntry.items = validatedItems;
  }

  // Update other fields
  if (billNumber) purchaseEntry.billNumber = billNumber;
  if (date) purchaseEntry.date = new Date(date);
  if (totalAmount !== undefined) purchaseEntry.totalAmount = totalAmount;
  if (discount !== undefined) purchaseEntry.discount = discount;
  if (paidAmount !== undefined) purchaseEntry.paidAmount = paidAmount;
  if (notes !== undefined) purchaseEntry.notes = notes;

  // Recalculate amounts
  purchaseEntry.finalAmount = purchaseEntry.totalAmount - purchaseEntry.discount;
  purchaseEntry.balanceAmount = purchaseEntry.finalAmount - purchaseEntry.paidAmount;

  await purchaseEntry.save();

  // Populate the response
  await purchaseEntry.populate([
    { path: 'supplier', select: 'name email phone' },
    { path: 'items.item', select: 'name code description' },
    { path: 'createdBy', select: 'first_name last_name' }
  ]);

  return respond(res, StatusCodes.OK, purchaseEntry);
});

// Delete purchase entry (soft delete)
export const deletePurchaseEntry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const purchaseEntry = await PurchaseEntry.findOne({
    _id: id,
    isActive: true
  });

  if (!purchaseEntry) {
    throw ApiError.notFound('Purchase entry not found');
  }

  purchaseEntry.isActive = false;
  await purchaseEntry.save();

  return respond(res, StatusCodes.OK, { success: true });
});

// Get purchase entry statistics
export const getPurchaseEntryStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await PurchaseEntry.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalAmount: { $sum: '$finalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        totalBalance: { $sum: '$balanceAmount' },
        avgAmount: { $avg: '$finalAmount' }
      }
    }
  ]);

  const result = stats[0] || {
    totalEntries: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalBalance: 0,
    avgAmount: 0
  };

  return respond(res, StatusCodes.OK, result);
});