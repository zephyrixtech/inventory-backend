import { Router } from 'express';
import {
  createPurchaseEntry,
  getPurchaseEntries,
  getPurchaseEntryById,
  updatePurchaseEntry,
  deletePurchaseEntry,
  getPurchaseEntryStats
} from '../controllers/purchase-entry.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.post('/', createPurchaseEntry);
router.get('/', getPurchaseEntries);
router.get('/stats', getPurchaseEntryStats);
router.get('/:id', getPurchaseEntryById);
router.put('/:id', updatePurchaseEntry);
router.delete('/:id', deletePurchaseEntry);

export default router;