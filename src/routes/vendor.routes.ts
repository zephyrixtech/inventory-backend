import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { listVendors, getVendor, createVendor, updateVendor, deactivateVendor } from '../controllers/vendor.controller';

const router = Router();

router.use(authenticate, authorize(['manage_vendors']));

router.get('/', listVendors);

router.get('/:id', [param('id').isMongoId()], validateRequest, getVendor);

router.post(
  '/',
  [body('name').notEmpty().withMessage('Vendor name is required'), body('email').optional().isEmail()],
  validateRequest,
  createVendor
);

router.put('/:id', [param('id').isMongoId()], validateRequest, updateVendor);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deactivateVendor);

export default router;

