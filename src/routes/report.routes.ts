import { Router } from 'express';
import { query } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import {
  getPurchaseReport,
  getStockReport,
  getSalesReport,
  getExpenseReport,
  getPackingListReport,
  getCreditNotesReport,
  getItemReport
} from '../controllers/report.controller';

const router = Router();

router.use(authenticate, authorize(['view_reports' , 'manage_packing']));

router.get(
  '/purchases',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validateRequest,
  getPurchaseReport
);
router.get('/stock', getStockReport);
router.get('/sales', [query('customerId').optional().isMongoId()], validateRequest, getSalesReport);
router.get(
  '/expenses',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validateRequest,
  getExpenseReport
);
router.get(
  '/credit-notes',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validateRequest,
  getCreditNotesReport
);
router.get(
  '/packing-lists',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validateRequest,
  getPackingListReport
);

router.get(
  '/items',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('itemIds').exists().isString()
  ],
  validateRequest,
  getItemReport
);

export default router;
