import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { ExpenseOpeningBalance } from '../models/expense-opening-balance.model';
import { DailyExpense } from '../models/daily-expense.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const listOpeningBalances = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const query = ExpenseOpeningBalance.find()
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  query.skip((pageNum - 1) * limitNum).limit(limitNum);

  const [balances, total] = await Promise.all([
    query.exec(),
    ExpenseOpeningBalance.countDocuments()
  ]);

  // Calculate total expenses for each balance
  const totalExpenses = await DailyExpense.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const totalExpenseAmount = totalExpenses.length > 0 ? totalExpenses[0].total : 0;

  const balancesWithCalculations = balances.map((balance) => ({
    _id: balance._id,
    amount: balance.amount,
    description: balance.description,
    date: balance.date,
    totalExpenses: totalExpenseAmount,
    remainingBalance: balance.amount - totalExpenseAmount,
    createdBy: balance.createdBy,
    updatedBy: balance.updatedBy,
    createdAt: balance.createdAt,
    updatedAt: balance.updatedAt
  }));

  return respond(res, StatusCodes.OK, balancesWithCalculations, {
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum)
  });
});

export const getOpeningBalance = asyncHandler(async (req: Request, res: Response) => {
  // Get the latest opening balance
  const openingBalance = await ExpenseOpeningBalance.findOne()
    .sort({ createdAt: -1 })
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');

  if (!openingBalance) {
    return respond(res, StatusCodes.OK, {
      amount: 0,
      description: '',
      totalExpenses: 0,
      remainingBalance: 0,
      date: new Date()
    });
  }

  // Calculate total expenses
  const totalExpenses = await DailyExpense.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const totalExpenseAmount = totalExpenses.length > 0 ? totalExpenses[0].total : 0;
  const remainingBalance = openingBalance.amount - totalExpenseAmount;

  return respond(res, StatusCodes.OK, {
    _id: openingBalance._id,
    amount: openingBalance.amount,
    description: openingBalance.description,
    date: openingBalance.date,
    totalExpenses: totalExpenseAmount,
    remainingBalance,
    createdBy: openingBalance.createdBy,
    updatedBy: openingBalance.updatedBy,
    createdAt: openingBalance.createdAt,
    updatedAt: openingBalance.updatedAt
  });
});

export const createOpeningBalance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { amount, description } = req.body;

  // Create new balance
  const openingBalance = await ExpenseOpeningBalance.create({
    amount,
    description: description || '',
    date: new Date(),
    createdBy: new Types.ObjectId(req.user.id),
    updatedBy: new Types.ObjectId(req.user.id)
  });

  // Calculate total expenses and remaining balance
  const totalExpenses = await DailyExpense.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const totalExpenseAmount = totalExpenses.length > 0 ? totalExpenses[0].total : 0;
  const remainingBalance = openingBalance.amount - totalExpenseAmount;

  const populatedBalance = await ExpenseOpeningBalance.findById(openingBalance._id)
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');

  return respond(
    res,
    StatusCodes.CREATED,
    {
      _id: populatedBalance!._id,
      amount: populatedBalance!.amount,
      description: populatedBalance!.description,
      date: populatedBalance!.date,
      totalExpenses: totalExpenseAmount,
      remainingBalance,
      createdBy: populatedBalance!.createdBy,
      updatedBy: populatedBalance!.updatedBy,
      createdAt: populatedBalance!.createdAt,
      updatedAt: populatedBalance!.updatedAt
    },
    { message: 'Opening balance created successfully' }
  );
});

export const updateOpeningBalance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { id } = req.params;
  const { amount, description } = req.body;

  const openingBalance = await ExpenseOpeningBalance.findById(id);

  if (!openingBalance) {
    throw ApiError.notFound('Opening balance not found');
  }

  openingBalance.amount = amount;
  openingBalance.description = description || '';
  openingBalance.date = new Date();
  openingBalance.updatedBy = new Types.ObjectId(req.user.id);
  await openingBalance.save();

  // Calculate total expenses and remaining balance
  const totalExpenses = await DailyExpense.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const totalExpenseAmount = totalExpenses.length > 0 ? totalExpenses[0].total : 0;
  const remainingBalance = openingBalance.amount - totalExpenseAmount;

  const populatedBalance = await ExpenseOpeningBalance.findById(openingBalance._id)
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');

  return respond(
    res,
    StatusCodes.OK,
    {
      _id: populatedBalance!._id,
      amount: populatedBalance!.amount,
      description: populatedBalance!.description,
      date: populatedBalance!.date,
      totalExpenses: totalExpenseAmount,
      remainingBalance,
      createdBy: populatedBalance!.createdBy,
      updatedBy: populatedBalance!.updatedBy,
      createdAt: populatedBalance!.createdAt,
      updatedAt: populatedBalance!.updatedAt
    },
    { message: 'Opening balance updated successfully' }
  );
});

export const deleteOpeningBalance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const openingBalance = await ExpenseOpeningBalance.findById(id);

  if (!openingBalance) {
    throw ApiError.notFound('Opening balance not found');
  }

  await openingBalance.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Opening balance deleted successfully' });
});
