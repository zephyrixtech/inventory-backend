import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { CurrencyRate } from '../models/currency-rate.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const getCurrencyRates = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const rates = await CurrencyRate.find({}).sort({ updatedAt: -1 });

  return respond(res, StatusCodes.OK, rates);
});

export const upsertCurrencyRate = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { fromCurrency, toCurrency, rate } = req.body;

  if (fromCurrency === toCurrency) {
    throw ApiError.badRequest('From and to currency should differ');
  }

  const currencyRate = await CurrencyRate.findOneAndUpdate(
    { fromCurrency, toCurrency },
    {
      rate,
      effectiveDate: new Date(),
      createdBy: req.user?.id
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return respond(res, StatusCodes.OK, currencyRate, { message: 'Currency rate saved successfully' });
});