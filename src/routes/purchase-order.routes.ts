import { Router } from 'express';
import { body, param } from 'express-validator';

import { listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from '../controllers/purchase-order.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_purchase_orders']));

router.get('/', listPurchaseOrders);

router.get('/:id', [param('id').isMongoId()], validateRequest, getPurchaseOrder);

router.post(
  '/',
  [
    body('poNumber').notEmpty(),
    body('supplierId').isMongoId(),
    body('items').isArray({ min: 1 }),
    body('items.*.itemId').isMongoId(),
    body('items.*.quantity').isNumeric(),
    body('items.*.unitPrice').isNumeric()
  ],
  validateRequest,
  createPurchaseOrder
);

router.put(
  '/:id',
  [param('id').isMongoId(), body('items').optional().isArray(), body('items.*.itemId').optional().isMongoId()],
  validateRequest,
  updatePurchaseOrder
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deletePurchaseOrder);

export default router;

