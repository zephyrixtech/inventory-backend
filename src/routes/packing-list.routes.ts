import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { listPackingLists, createPackingList, updatePackingList } from '../controllers/packing-list.controller';

const router = Router();

router.use(authenticate, authorize(['manage_packing']));

router.get('/', listPackingLists);

router.post(
  '/',
  [
    body('location').notEmpty(),
    body('boxNumber').notEmpty(),
    body('items').isArray({ min: 1 }),
    body('items.*.productId').isMongoId(),
    body('items.*.quantity').isNumeric()
  ],
  validateRequest,
  createPackingList
);

router.put(
  '/:id',
  [param('id').isMongoId(), body('items').optional().isArray(), body('items.*.productId').optional().isMongoId()],
  validateRequest,
  updatePackingList
);

export default router;

