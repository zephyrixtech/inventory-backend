import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit-log.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, authorize(['view_audit_logs']), listAuditLogs);

export default router;
