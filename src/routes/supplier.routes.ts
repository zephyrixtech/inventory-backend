import { Router } from 'express';
import { body, param } from 'express-validator';

import { listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplier.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_suppliers']));

router.get('/', listSuppliers);

router.get('/:id', [param('id').isMongoId()], validateRequest, getSupplier);

router.post(
  '/',
  [
    body('supplierId').notEmpty(),
    body('name').notEmpty(),
    body('status').isIn(['pending', 'approved', 'rejected']),
    // Optional fields can be validated here if needed
  ],
  validateRequest,
  createSupplier
);

router.put('/:id', [param('id').isMongoId()], validateRequest, updateSupplier);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteSupplier);

export default router;