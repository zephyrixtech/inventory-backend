import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { DailyExpense } from '../models/daily-expense.model';
import { Item } from '../models/item.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listDailyExpenses = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  const { from, to, productId } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  // Removed company context - using empty filters object
  const filters: Record<string, unknown> = {};

  if (productId) {
    filters.product = productId;
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

  const query = DailyExpense.find(filters).populate('product', 'name code').populate('createdBy', 'firstName lastName');

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
  // Removed company context check since we're removing company context
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { productId, description, amount, date, type } = req.body;

  // Removed company filter since we're removing company context
  const product = await Item.findById(productId);

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  const expense = await DailyExpense.create({
    // Removed company field since we're removing company context
    product: product._id,
    description,
    amount,
    date,
    type,
    createdBy: req.user.id
  });

  return respond(res, StatusCodes.CREATED, expense, { message: 'Expense recorded successfully' });
});

export const deleteDailyExpense = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const expense = await DailyExpense.findById(req.params.id);

  if (!expense) {
    throw ApiError.notFound('Expense not found');
  }

  await expense.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Expense removed successfully' });
});