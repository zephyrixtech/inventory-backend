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
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { productId, status, remarks, damagedQuantity, inspectorName, storeId } = req.body;

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
  if (req.user.id) {
    const checker = await User.findById(req.user.id).select(['firstName', 'lastName']);
    if (checker) {
      checkerName = `${checker.firstName ?? ''} ${checker.lastName ?? ''}`.trim() || undefined;
    }
  }

  const sanitizedDamagedQuantity =
    damagedQuantity !== undefined ? Number(damagedQuantity) : undefined;

  const previousQcRecord = await QualityCheck.findOne({ product: product._id });
  const wasPreviouslyApproved = previousQcRecord?.status === 'approved';

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
    const totalQty = product.quantity || 0;
    product.availableQuantity = Math.max(0, totalQty - sanitizedDamagedQuantity);
  }

  product.status =
    status === 'approved' ? 'store_pending' : status === 'rejected' ? 'qc_failed' : 'pending_qc';

  await product.save();

  if (status === 'approved' && !wasPreviouslyApproved) {
    if (!storeId) {
      throw ApiError.badRequest('Please select a purchaser store before approving QC');
    }

    const purchaserStore = await Store.findOne({
      _id: storeId,
      purchaser: 'ROLE_PURCHASER',
      isActive: true
    });

    if (!purchaserStore) {
      throw ApiError.badRequest('Selected store is not an active purchaser store');
    }

    const availableQuantity = Math.max(0, product.availableQuantity ?? product.quantity ?? 0);

    if (availableQuantity > 0) {
      const existingStock = await StoreStock.findOne({
        product: product._id,
        store: purchaserStore._id
      });

      if (!existingStock) {
        await StoreStock.create({
          product: product._id,
          store: purchaserStore._id,
          quantity: availableQuantity,
          margin: 0,
          currency: product.currency || 'INR',
          unitPrice: product.unitPrice || 0,
          lastUpdatedBy: req.user.id
        });
      } else {
        existingStock.quantity += availableQuantity;
        existingStock.lastUpdatedBy = req.user.id as any;
        await existingStock.save();
      }
    }
  }

  return respond(res, StatusCodes.OK, qcRecord, { message: 'Quality check submitted successfully' });
});

export const getQualityCheck = asyncHandler(async (req: Request, res: Response) => {
  const record = await QualityCheck.findOne({ product: req.params.productId });

  if (!record) {
    throw ApiError.notFound('Quality check record not found');
  }

  return respond(res, StatusCodes.OK, record);
});
