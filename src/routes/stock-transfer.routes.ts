import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { approveStockTransfer, createStockTransfer, listStockTransfers } from '../controllers/stock-transfer.controller';

const router = Router();

router.use(authenticate, authorize(['manage_inventory']));

router.get('/', listStockTransfers);

router.post(
  '/',
  [
    body('fromStoreId').isMongoId(),
    body('toStoreId').isMongoId(),
    body('productId').isMongoId(),
    body('quantity').isNumeric(),
    body('notes').optional().isString()
  ],
  validateRequest,
  createStockTransfer
);

router.post('/:id/approve', [param('id').isMongoId()], validateRequest, approveStockTransfer);

export default router;

