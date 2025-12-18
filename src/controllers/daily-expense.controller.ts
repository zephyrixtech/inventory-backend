import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { DailyExpense } from '../models/daily-expense.model';
import { Supplier, type SupplierDocument } from '../models/supplier.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listDailyExpenses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { from, to, supplierId } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  // Get user from database to check role
  const user = await User.findById(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  // Apply user-specific filtering based on role
  if (user.role === 'purchaser' || user.role === 'biller') {
    // Purchasers and billers can only see their own created expenses
    filters.createdBy = req.user.id;
  }
  // superadmin and admin can see all expenses (no additional filter needed)

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

export const updateDailyExpense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { id } = req.params;
  const { supplierId, description, amount, date, type, paymentType, transactionId } = req.body;

  // Get user from database to check role
  const user = await User.findById(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  // Build query filters based on user role
  const filters: Record<string, unknown> = { _id: id };
  if (user.role === 'purchaser' || user.role === 'biller') {
    // Purchasers and billers can only update their own created expenses
    filters.createdBy = req.user.id;
  }

  const expense = await DailyExpense.findOne(filters);
  if (!expense) {
    throw ApiError.notFound('Expense not found or you do not have permission to update it');
  }

  // Validate transactionId for card and upi payments if they are being updated
  const finalPaymentType = paymentType || expense.paymentType;
  const finalTransactionId = transactionId !== undefined ? transactionId : expense.transactionId;

  if ((finalPaymentType === 'card' || finalPaymentType === 'upi') && !finalTransactionId) {
    throw ApiError.badRequest('Transaction ID is required for card and UPI payments');
  }

  let supplier: SupplierDocument | null = null;
  if (supplierId) {
    supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw ApiError.notFound('Supplier not found');
    }
  }

  // Update fields
  if (supplierId !== undefined) expense.supplier = supplier ? supplier._id : undefined;
  if (description !== undefined) expense.description = description;
  if (amount !== undefined) expense.amount = amount;
  if (date !== undefined) expense.date = date;
  if (type !== undefined) expense.type = type;
  if (paymentType !== undefined) expense.paymentType = paymentType;
  if (transactionId !== undefined) expense.transactionId = transactionId;

  await expense.save();

  const populatedExpense = await DailyExpense.findById(expense._id).populate('supplier', 'name');

  return respond(res, StatusCodes.OK, populatedExpense, { message: 'Expense updated successfully' });
});

export const deleteDailyExpense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  // Get user from database to check role
  const user = await User.findById(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  // Build query filters based on user role
  const filters: Record<string, unknown> = { _id: req.params.id };
  if (user.role === 'purchaser' || user.role === 'biller') {
    // Purchasers and billers can only delete their own created expenses
    filters.createdBy = req.user.id;
  }

  const expense = await DailyExpense.findOne(filters);
  if (!expense) {
    throw ApiError.notFound('Expense not found or you do not have permission to delete it');
  }

  await expense.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Expense removed successfully' });
});