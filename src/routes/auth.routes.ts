import { Router } from 'express';
import { body } from 'express-validator';

import { register, login, refresh, logout, me, changePassword } from '../controllers/auth.controller';
import { authRateLimiter } from '../middlewares/rate-limiter';
import { authenticate } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.post(
  '/register',
  [
    body('companyName').notEmpty().withMessage('Company name is required'),
    body('companyCode').notEmpty().withMessage('Company code is required'),
    body('currency').notEmpty().withMessage('Currency is required'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  authRateLimiter,
  [body('email').isEmail().withMessage('Valid email is required'), body('password').notEmpty().withMessage('Password is required')],
  validateRequest,
  login
);

router.post('/refresh', [body('refreshToken').notEmpty().withMessage('Refresh token is required')], validateRequest, refresh);

router.post('/logout', [body('refreshToken').optional().isString()], validateRequest, logout);

router.get('/me', authenticate, me);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
  ],
  validateRequest,
  changePassword
);

export default router;

