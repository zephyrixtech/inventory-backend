import { Router } from 'express';
import { body, param } from 'express-validator';

import { listInventory, createInventoryRecord, updateInventoryRecord, deleteInventoryRecord } from '../controllers/inventory.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_inventory']));

router.get('/', listInventory);

router.post(
  '/',
  [
    body('itemId').isMongoId(),
    body('storeId').isMongoId(),
    body('quantity').isNumeric(),
    body('unitPrice').optional().isNumeric(),
    body('sellingPrice').optional().isNumeric(),
    body('purchaseOrderId').optional().isMongoId()
  ],
  validateRequest,
  createInventoryRecord
);

router.put(
  '/:id',
  [param('id').isMongoId(), body('quantity').optional().isNumeric(), body('unitPrice').optional().isNumeric()],
  validateRequest,
  updateInventoryRecord
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteInventoryRecord);

export default router;

