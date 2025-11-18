import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { listStoreStock, upsertStoreStock, adjustStockQuantity } from '../controllers/store-stock.controller';

const router = Router();

router.use(authenticate, authorize(['manage_store_stock']));

router.get('/', listStoreStock);

router.post(
  '/',
  [body('productId').isMongoId(), body('quantity').isNumeric(), body('margin').optional().isNumeric()],
  validateRequest,
  upsertStoreStock
);

router.put('/:id/quantity', [param('id').isMongoId(), body('quantity').isNumeric()], validateRequest, adjustStockQuantity);

export default router;

