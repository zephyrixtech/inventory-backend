import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { QualityCheck } from '../models/quality-check.model';
import { Item } from '../models/item.model';
import { User } from '../models/user.model';
import { Store } from '../models/store.model';
import { StoreStock } from '../models/store-stock.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const submitQualityCheck = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { productId, status, remarks, damagedQuantity, inspectorName } = req.body;

  // Removed company filter since we're removing company context
  const product = await Item.findById(productId);

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw ApiError.badRequest('Invalid QC status');
  }
  if (damagedQuantity !== undefined) {
    const parsed = Number(damagedQuantity);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw ApiError.badRequest('Damaged quantity must be a non-negative number');
    }
  }

  let checkerName: string | undefined;
  if (req.user?.id) {
    const checker = await User.findById(req.user.id).select(['firstName', 'lastName']);
    if (checker) {
      checkerName = `${checker.firstName ?? ''} ${checker.lastName ?? ''}`.trim() || undefined;
    }
  }

  const sanitizedDamagedQuantity =
    damagedQuantity !== undefined ? Number(damagedQuantity) : undefined;

  const updatePayload: Record<string, unknown> = {
    status,
    remarks,
    checkedBy: req.user.id,
    checkedByName: checkerName,
    inspectorName,
    submittedBy: req.user.id,
    submittedByName: checkerName,
    checkedAt: new Date()
  };
  if (sanitizedDamagedQuantity !== undefined) {
    updatePayload.damagedQuantity = sanitizedDamagedQuantity;
  }

  // Removed company filter since we're removing company context
  const qcRecord =
    (await QualityCheck.findOneAndUpdate(
      { product: product._id },
      updatePayload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )) ?? null;

  product.qcStatus = status as 'approved' | 'rejected' | 'pending';
  product.qcRemarks = remarks;
  product.qcCheckedAt = new Date();
  product.qcCheckedBy = req.user.id as any;
  if (checkerName) {
    product.qcCheckedByName = checkerName;
    product.qcSubmittedByName = checkerName;
  }
  if (inspectorName) {
    product.inspectorName = inspectorName;
  }
  product.qcSubmittedBy = req.user.id as any;
  if (sanitizedDamagedQuantity !== undefined) {
    product.damagedQuantity = sanitizedDamagedQuantity;
    // Update availableQuantity
    const totalQty = product.quantity || 0;
    product.availableQuantity = Math.max(0, totalQty - sanitizedDamagedQuantity);
  }
  product.status = status === 'approved' ? 'store_pending' : status === 'rejected' ? 'qc_failed' : 'pending_qc';

  await product.save();

  // Auto-create store stock entries for approved items in purchaser stores
  if (status === 'approved') {
    try {
      console.log(`[QC Approval] Processing store stock update for product: ${product._id} (${product.name})`);

      // Find all stores with purchaser role
      // Robust query: Look for stores with purchaser role assigned OR strictly manage role if specifically needed
      // First try strict purchaser role
      let purchaserStores = await Store.find({
        purchaser: 'ROLE_PURCHASER',
        isActive: true
      });

      console.log(`[QC Approval] Found ${purchaserStores.length} stores with purchaser='ROLE_PURCHASER'`);

      // Fallback: if no purchaser stores found, try finding generic stores (optional, based on业务 logic)
      if (purchaserStores.length === 0) {
        console.warn('[QC Approval] No stores found with purchaser="ROLE_PURCHASER". Trying fallback to find any active store to avoid data loss (optional policy).');
        // Uncomment below if you want tofallback to all active stores or specific manager stores
        // purchaserStores = await Store.find({ isActive: true }); 
      }

      if (purchaserStores.length === 0) {
        console.warn('[QC Approval] CRITICAL: No target stores found to add stock. Stock will NOT be updated in any store.');
      }

      // Create store stock entries for each purchaser store
      for (const store of purchaserStores) {
        // Check if store stock already exists for this product and store
        const existingStock = await StoreStock.findOne({
          product: product._id,
          store: store._id
        });

        const availableQuantity = Math.max(0, (product.quantity || 0) - (sanitizedDamagedQuantity || 0));

        if (!existingStock) {
          if (availableQuantity > 0) {
            console.log(`[QC Approval] Creating new stock entry for Store: ${store.name} (${store._id}), Qty: ${availableQuantity}`);
            // Create new store stock entry
            await StoreStock.create({
              product: product._id,
              store: store._id,
              quantity: availableQuantity,
              margin: 0, // Default margin
              currency: product.currency || 'INR',
              unitPrice: product.unitPrice || 0,
              lastUpdatedBy: req.user.id
            });
          } else {
            console.log(`[QC Approval] Skipping creation for Store: ${store.name} - Available Qty is 0`);
          }
        } else {
          // Update existing stock quantity
          if (availableQuantity > 0) {
            console.log(`[QC Approval] Updating existing stock for Store: ${store.name} (${store._id}). Adding Qty: ${availableQuantity}`);
            existingStock.quantity += availableQuantity;
            existingStock.lastUpdatedBy = req.user.id as any;
            await existingStock.save();
          } else {
            console.log(`[QC Approval] No quantity to add for Store: ${store.name}`);
          }
        }
      }
    } catch (error) {
      console.error('[QC Approval] Failed to auto-create store stock entries:', error);
      // Don't fail the QC process if store stock creation fails
      // Just log the error and continue
    }
  }

  return respond(res, StatusCodes.OK, qcRecord, { message: 'Quality check submitted successfully' });
});

export const getQualityCheck = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const record = await QualityCheck.findOne({ product: req.params.productId });

  if (!record) {
    throw ApiError.notFound('Quality check record not found');
  }

  return respond(res, StatusCodes.OK, record);
});