import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { listDailyExpenses, createDailyExpense, deleteDailyExpense, updateDailyExpense } from '../controllers/daily-expense.controller';

const router = Router();

router.use(authenticate, authorize(['manage_expenses']));

router.get('/', listDailyExpenses);

router.post(
  '/',
  [
    body('supplierId').optional().isMongoId(),
    body('description').notEmpty(),
    body('amount').isNumeric(),
    body('date').optional().isISO8601(),
    body('type').isIn(['purchase', 'petty']),
    body('paymentType').optional().isIn(['cash', 'card', 'upi'])
  ],
  validateRequest,
  createDailyExpense
);

router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('supplierId').optional().isMongoId(),
    body('description').optional().notEmpty(),
    body('amount').optional().isNumeric(),
    body('date').optional().isISO8601(),
    body('type').optional().isIn(['purchase', 'petty']),
    body('paymentType').optional().isIn(['cash', 'card', 'upi'])
  ],
  validateRequest,
  updateDailyExpense
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteDailyExpense);

export default router;