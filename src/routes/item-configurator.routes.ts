import { Router } from 'express';
import { body, param } from 'express-validator';

import { 
  listItemConfigurations, 
  getItemConfiguration, 
  createItemConfiguration, 
  createMultipleItemConfigurations,
  updateItemConfiguration, 
  deleteItemConfiguration 
} from '../controllers/item-configurator.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_catalog']));

router.get('/', listItemConfigurations);

router.get('/:id', [
  param('id').isMongoId()
], validateRequest, getItemConfiguration);

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('control_type').isIn(['Textbox', 'Dropdown', 'Textarea']).withMessage('Invalid control type'),
    body('sequence').isInt({ min: 1 }).withMessage('Sequence must be a positive integer'),
    body('collection_id').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      // Allow both valid MongoDB ObjectIds and simple string/numeric IDs
      return typeof value === 'string' && (value.length === 24 || /^[0-9]+$/.test(value));
    }).withMessage('Invalid collection ID'),
    body('data_type').optional({ nullable: true }).isIn(['text', 'number', 'unit']).withMessage('Invalid data type'),
    body('max_length').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Max length must be a non-negative integer'),
    body('item_unit_id').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      // Allow both valid MongoDB ObjectIds and simple string/numeric IDs
      return typeof value === 'string' && (value.length === 24 || /^[0-9]+$/.test(value));
    }).withMessage('Invalid item unit ID'),
    body('is_mandatory').optional({ nullable: true }).isBoolean().withMessage('is_mandatory must be a boolean')
  ],
  validateRequest,
  createItemConfiguration
);

router.post(
  '/bulk',
  [
    body().isArray().withMessage('Request body must be an array'),
    body('*.name').notEmpty().withMessage('Name is required for all configurations'),
    body('*.control_type').isIn(['Textbox', 'Dropdown', 'Textarea']).withMessage('Invalid control type'),
    body('*.sequence').isInt({ min: 1 }).withMessage('Sequence must be a positive integer'),
    body('*.collection_id').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      // Allow both valid MongoDB ObjectIds and simple string/numeric IDs
      return typeof value === 'string' && (value.length === 24 || /^[0-9]+$/.test(value));
    }).withMessage('Invalid collection ID'),
    body('*.data_type').optional({ nullable: true }).isIn(['text', 'number', 'unit']).withMessage('Invalid data type'),
    body('*.max_length').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Max length must be a non-negative integer'),
    body('*.item_unit_id').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      // Allow both valid MongoDB ObjectIds and simple string/numeric IDs
      return typeof value === 'string' && (value.length === 24 || /^[0-9]+$/.test(value));
    }).withMessage('Invalid item unit ID'),
    body('*.is_mandatory').optional({ nullable: true }).isBoolean().withMessage('is_mandatory must be a boolean')
  ],
  validateRequest,
  createMultipleItemConfigurations
);

router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('name').optional({ nullable: true }).notEmpty().withMessage('Name cannot be empty'),
    body('control_type').optional({ nullable: true }).isIn(['Textbox', 'Dropdown', 'Textarea']).withMessage('Invalid control type'),
    body('sequence').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Sequence must be a positive integer'),
    body('collection_id').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      // Allow both valid MongoDB ObjectIds and simple string/numeric IDs
      return typeof value === 'string' && (value.length === 24 || /^[0-9]+$/.test(value));
    }).withMessage('Invalid collection ID'),
    body('data_type').optional({ nullable: true }).isIn(['text', 'number', 'unit']).withMessage('Invalid data type'),
    body('max_length').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Max length must be a non-negative integer'),
    body('item_unit_id').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      // Allow both valid MongoDB ObjectIds and simple string/numeric IDs
      return typeof value === 'string' && (value.length === 24 || /^[0-9]+$/.test(value));
    }).withMessage('Invalid item unit ID'),
    body('is_mandatory').optional({ nullable: true }).isBoolean().withMessage('is_mandatory must be a boolean'),
    body('isActive').optional({ nullable: true }).isBoolean().withMessage('isActive must be a boolean')
  ],
  validateRequest,
  updateItemConfiguration
);

router.delete('/:id', [
  param('id').isMongoId()
], validateRequest, deleteItemConfiguration);

export default router;