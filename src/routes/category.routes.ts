import { Router } from 'express';
import { body, param } from 'express-validator';

import { listCategories, getCategory, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_catalog']));

router.get('/', listCategories);

router.get('/:id', [param('id').isMongoId()], validateRequest, getCategory);

router.post('/', [
  body('name').notEmpty(),
  body('subCategory').optional().isString()
], validateRequest, createCategory);

router.put('/:id', [
  param('id').isMongoId()
], validateRequest, updateCategory);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteCategory);

export default router;