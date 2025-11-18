import { Router } from 'express';
import { body, param } from 'express-validator';

import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate);

router.get('/', listUsers);

router.get('/:id', [param('id').isMongoId()], validateRequest, getUser);

router.post(
  '/',
  authorize(['manage_users']),
  [
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('role')
      .isString()
      .trim()
      .isIn(['superadmin', 'admin', 'purchaser', 'biller'])
  ],
  validateRequest,
  createUser
);

router.put(
  '/:id',
  authorize(['manage_users']),
  [
    param('id').isMongoId(),
    body('email').optional().isEmail(),
    body('role')
      .optional()
      .isString()
      .trim()
      .isIn(['superadmin', 'admin', 'purchaser', 'biller'])
  ],
  validateRequest,
  updateUser
);

router.delete('/:id', authorize(['manage_users']), [param('id').isMongoId()], validateRequest, deleteUser);

export default router;

