import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { DailyExpense } from '../models/daily-expense.model';
import { Supplier, type SupplierDocument } from '../models/supplier.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listDailyExpenses = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, supplierId } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (supplierId) {
    filters.supplier = supplierId;
  }

  if (from || to) {
    filters.date = {};
    if (from) {
      (filters.date as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.date as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  const query = DailyExpense.find(filters).populate('supplier', 'name').populate('createdBy', 'firstName lastName');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ date: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [expenses, total] = await Promise.all([query.exec(), DailyExpense.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, expenses, buildPaginationMeta(page, limit, total));
});

export const createDailyExpense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { supplierId, description, amount, date, type, paymentType, transactionId } = req.body;

  // Validate transactionId for card and upi payments
  if ((paymentType === 'card' || paymentType === 'upi') && !transactionId) {
    throw ApiError.badRequest('Transaction ID is required for card and UPI payments');
  }

  let supplier: SupplierDocument | null = null;
  if (supplierId) {
    supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw ApiError.notFound('Supplier not found');
    }
  }

  const expense = await DailyExpense.create({
    supplier: supplier ? supplier._id : undefined,
    description,
    amount,
    date,
    type,
    paymentType,
    transactionId,
    createdBy: req.user.id
  });

  // Populate supplier name in response
  const populatedExpense = await DailyExpense.findById(expense._id).populate('supplier', 'name');

  return respond(res, StatusCodes.CREATED, populatedExpense, { message: 'Expense recorded successfully' });
});

export const deleteDailyExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await DailyExpense.findById(req.params.id);

  if (!expense) {
    throw ApiError.notFound('Expense not found');
  }

  await expense.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Expense removed successfully' });
});