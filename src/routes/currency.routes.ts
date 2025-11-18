import { Router } from 'express';
import { body } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { getCurrencyRates, upsertCurrencyRate } from '../controllers/currency.controller';

const router = Router();

router.use(authenticate, authorize(['manage_currency']));

router.get('/', getCurrencyRates);

router.post(
  '/',
  [body('fromCurrency').isIn(['INR', 'AED']), body('toCurrency').isIn(['INR', 'AED']), body('rate').isNumeric()],
  validateRequest,
  upsertCurrencyRate
);

export default router;

