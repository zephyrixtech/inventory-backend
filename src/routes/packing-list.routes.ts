import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { listPackingLists, createPackingList, getPackingList, updatePackingList, deletePackingList, approvePackingList } from '../controllers/packing-list.controller';

const router = Router();

router.use(authenticate, authorize(['manage_packing']));

router.get('/', listPackingLists);

router.post(
  '/',
  [
    body('boxNumber').notEmpty(),
    body('items').isArray({ min: 1 }),
    body('items.*.productId').isMongoId(),
    body('items.*.quantity').isNumeric()
  ],
  validateRequest,
  createPackingList
);

router.get('/:id', [param('id').isMongoId()], validateRequest, getPackingList);

router.put(
  '/:id',
  [param('id').isMongoId(), body('items').optional().isArray(), body('items.*.productId').optional().isMongoId()],
  validateRequest,
  updatePackingList
);

router.post(
  '/:id/approve',
  [param('id').isMongoId()],
  validateRequest,
  approvePackingList
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deletePackingList);

export default router;