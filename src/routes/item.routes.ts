import { Router } from 'express';
import { body, param } from 'express-validator';

import { listItem, getItem, createItem, updateItem, deleteItem } from '../controllers/item.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

// router.use(authenticate);

router.get('/', listItem);

router.get('/:id', [param('id').isMongoId().withMessage('Invalid item ID')], validateRequest, getItem);

router.post(
  '/',
  [
    body('name').notEmpty(),
    body('code').optional(), // Make code optional since it will be auto-generated if not provided
    body('billNumber').notEmpty().withMessage('Bill number is required'), // Changed from category to billNumber
    body('reorderLevel').optional().isInt({ min: 0 }),
    body('maxLevel').optional().isInt({ min: 0 }),
    body('videoType').optional().isIn(['upload', 'youtube']),
    body('youtubeLink').optional({ nullable: true }).isString().withMessage('YouTube link must be a string'),
    body('additionalAttributes').optional().isObject()
  ],
  validateRequest,
  createItem
);

router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid item ID'),
    body('billNumber').optional().notEmpty().withMessage('Bill number cannot be empty'), // Changed from category to billNumber
    body('reorderLevel').optional().isInt({ min: 0 }).withMessage('Reorder level must be a non-negative integer'),
    body('maxLevel').optional().isInt({ min: 0 }).withMessage('Max level must be a non-negative integer'),
    body('videoType').optional().isIn(['upload', 'youtube']),
    body('youtubeLink').optional({ nullable: true }).isString().withMessage('YouTube link must be a string'),
    body('additionalAttributes').optional().isObject()
  ],
  validateRequest,
  updateItem
);

router.delete('/:id', [param('id').isMongoId().withMessage('Invalid item ID')], validateRequest, deleteItem);

export default router;