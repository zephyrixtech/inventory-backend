import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { QualityCheck } from '../models/quality-check.model';
import { Item } from '../models/item.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const submitQualityCheck = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId || !req.user) {
    throw ApiError.badRequest('Company context missing');
  }

  const { productId, status, remarks } = req.body;

  const product = await Item.findOne({ _id: productId, company: companyId });

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw ApiError.badRequest('Invalid QC status');
  }

  const qcRecord =
    (await QualityCheck.findOneAndUpdate(
      { company: companyId, product: product._id },
      {
        status,
        remarks,
        checkedBy: req.user.id,
        checkedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )) ?? null;

  product.qcStatus = status as 'approved' | 'rejected' | 'pending';
  product.qcRemarks = remarks;
  product.qcCheckedAt = new Date();
  product.qcCheckedBy = req.user.id as any;
  product.status = status === 'approved' ? 'store_pending' : status === 'rejected' ? 'qc_failed' : 'pending_qc';

  await product.save();

  return respond(res, StatusCodes.OK, qcRecord, { message: 'Quality check submitted successfully' });
});

export const getQualityCheck = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const record = await QualityCheck.findOne({ company: companyId, product: req.params.productId });

  if (!record) {
    throw ApiError.notFound('Quality check record not found');
  }

  return respond(res, StatusCodes.OK, record);
});

