import { Router } from 'express';
import { body, param } from 'express-validator';

import { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } from '../controllers/customer.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_customers']));

router.get('/', listCustomers);

router.get('/:id', [param('id').isMongoId()], validateRequest, getCustomer);

router.post(
  '/',
  [body('customerId').notEmpty(), body('name').notEmpty(), body('status').optional().isIn(['Active', 'Inactive'])],
  validateRequest,
  createCustomer
);

router.put('/:id', [param('id').isMongoId()], validateRequest, updateCustomer);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteCustomer);

export default router;

