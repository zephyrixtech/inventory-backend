import { Router } from 'express';
import { body, param } from 'express-validator';

import { listSalesInvoices, getSalesInvoice, createSalesInvoice, updateSalesInvoice, deleteSalesInvoice } from '../controllers/sales-invoice.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_sales']));

router.get('/', listSalesInvoices);

router.get('/:id', [param('id').isMongoId()], validateRequest, getSalesInvoice);

router.post(
  '/',
  [
    body('invoiceNumber').notEmpty(),
    body('customerId').isMongoId(),
    body('storeId').isMongoId(),
    body('items').isArray({ min: 1 }),
    body('items.*.itemId').isMongoId(),
    body('items.*.quantity').isNumeric(),
    body('items.*.unitPrice').isNumeric()
  ],
  validateRequest,
  createSalesInvoice
);

router.put(
  '/:id',
  [param('id').isMongoId(), body('items').optional().isArray(), body('items.*.itemId').optional().isMongoId()],
  validateRequest,
  updateSalesInvoice
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteSalesInvoice);

export default router;

