import { Router } from 'express';
import { body } from 'express-validator';

import { getCompany, updateCompany } from '../controllers/company.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_company']));

router.get('/', getCompany);

router.put(
  '/',
  [
    body('name').optional().isString().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isString().trim(),
    body('currency').optional().isString().trim().isLength({ min: 1, max: 10 }),
    body('taxPercentage').optional().isNumeric().isFloat({ min: 0, max: 100 }),
  ],
  validateRequest,
  updateCompany
);

export default router;

