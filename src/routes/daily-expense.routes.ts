import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { listDailyExpenses, createDailyExpense, deleteDailyExpense } from '../controllers/daily-expense.controller';

const router = Router();

router.use(authenticate, authorize(['manage_expenses']));

router.get('/', listDailyExpenses);

router.post(
  '/',
  [body('productId').isMongoId(), body('description').notEmpty(), body('amount').isNumeric(), body('date').optional().isISO8601()],
  validateRequest,
  createDailyExpense
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteDailyExpense);

export default router;

