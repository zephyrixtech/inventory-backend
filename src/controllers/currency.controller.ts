import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { CurrencyRate } from '../models/currency-rate.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const getCurrencyRates = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const rates = await CurrencyRate.find({ company: companyId }).sort({ updatedAt: -1 });

  return respond(res, StatusCodes.OK, rates);
});

export const upsertCurrencyRate = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId || !req.user) {
    throw ApiError.badRequest('Company context missing');
  }

  const { fromCurrency, toCurrency, rate } = req.body;

  if (fromCurrency === toCurrency) {
    throw ApiError.badRequest('From and to currency should differ');
  }

  const currencyRate = await CurrencyRate.findOneAndUpdate(
    { company: companyId, fromCurrency, toCurrency },
    {
      rate,
      effectiveDate: new Date(),
      createdBy: req.user.id
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return respond(res, StatusCodes.OK, currencyRate, { message: 'Currency rate saved successfully' });
});

