import { Router } from 'express';
import { query } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { getPurchaseReport, getStockReport, getSalesReport, getExpenseReport, getPackingListReport } from '../controllers/report.controller';

const router = Router();

router.use(authenticate, authorize(['view_reports']));

router.get(
  '/purchases',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validateRequest,
  getPurchaseReport
);
router.get('/stock', getStockReport);
router.get('/sales', [query('customerId').optional().isMongoId()], validateRequest, getSalesReport);
router.get('/expenses', getExpenseReport);
router.get(
  '/packing-lists',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validateRequest,
  getPackingListReport
);

export default router;

