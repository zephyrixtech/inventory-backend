import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { submitQualityCheck, getQualityCheck } from '../controllers/quality-check.controller';

const router = Router();

router.use(authenticate, authorize(['manage_qc']));

router.post(
  '/',
  [body('productId').isMongoId(), body('status').isIn(['approved', 'rejected', 'pending'])],
  validateRequest,
  submitQualityCheck
);

router.get('/:productId', [param('productId').isMongoId()], validateRequest, getQualityCheck);

export default router;

