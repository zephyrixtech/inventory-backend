import { Router } from 'express';
import { body, param } from 'express-validator';

import { listRoles, createRole, updateRole, deleteRole } from '../controllers/role.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

router.use(authenticate, authorize(['manage_roles']));

router.get('/', listRoles);

router.post('/', [body('name').notEmpty(), body('permissions').isArray().optional()], validateRequest, createRole);

router.put('/:id', [param('id').isMongoId()], validateRequest, updateRole);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteRole);

export default router;

