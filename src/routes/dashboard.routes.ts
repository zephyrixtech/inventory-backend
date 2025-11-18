import { Router } from 'express';

import { getDashboardMetrics } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getDashboardMetrics);

export default router;

