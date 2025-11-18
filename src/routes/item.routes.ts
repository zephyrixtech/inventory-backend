import { Router } from 'express';
import { body, param } from 'express-validator';

import { listItems, getItem, createItem, updateItem, deleteItem } from '../controllers/item.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_catalog']));

router.get('/', listItems);

router.get('/:id', [param('id').isMongoId()], validateRequest, getItem);

router.post(
  '/',
  [
    body('name').notEmpty(),
    body('code').notEmpty(),
    body('categoryId').isMongoId(),
    body('reorderLevel').optional().isInt({ min: 0 }),
    body('maxLevel').optional().isInt({ min: 0 })
  ],
  validateRequest,
  createItem
);

router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('categoryId').optional().isMongoId(),
    body('reorderLevel').optional().isInt({ min: 0 }),
    body('maxLevel').optional().isInt({ min: 0 })
  ],
  validateRequest,
  updateItem
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteItem);

export default router;

