import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { PackingList } from '../models/packing-list.model';
import { Item } from '../models/item.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

const normalizeItems = async (
  companyId: NonNullable<Request['companyId']>,
  items: Array<{ productId: string; quantity: number }>
) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Packing list items are required');
  }

  const normalized: Array<{ product: Types.ObjectId; quantity: number }> = [];

  for (const entry of items) {
    const product = await Item.findOne({ _id: entry.productId, company: companyId });
    if (!product) {
      throw ApiError.badRequest(`Invalid product: ${entry.productId}`);
    }

    normalized.push({
      product: product._id,
      quantity: entry.quantity
    });

    if (product.status === 'store_pending') {
      product.status = 'store_pending';
      await product.save();
    }
  }

  return normalized;
};

export const listPackingLists = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = { company: companyId };

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (search && typeof search === 'string') {
    filters.$or = [{ boxNumber: new RegExp(search, 'i') }, { location: new RegExp(search, 'i') }];
  }

  const query = PackingList.find(filters)
    .populate('items.product', 'name code status')
    .populate('createdBy', 'firstName lastName');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [lists, total] = await Promise.all([query.exec(), PackingList.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, lists, buildPaginationMeta(page, limit, total));
});

export const createPackingList = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId || !req.user) {
    throw ApiError.badRequest('Company context missing');
  }

  const { location, boxNumber, items, shipmentDate, packingDate, image } = req.body;

  const existing = await PackingList.findOne({ company: companyId, boxNumber });
  if (existing) {
    throw ApiError.conflict('Packing list with this box number already exists');
  }

  const normalizedItems = await normalizeItems(companyId, items ?? []);

  const packingList = await PackingList.create({
    company: companyId,
    location,
    boxNumber,
    items: normalizedItems,
    shipmentDate,
    packingDate,
    image,
    status: 'pending',
    createdBy: new Types.ObjectId(req.user.id)
  });

  return respond(res, StatusCodes.CREATED, packingList, { message: 'Packing list created successfully' });
});

export const updatePackingList = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const packingList = await PackingList.findOne({ _id: req.params.id, company: companyId });

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  const { location, items, shipmentDate, packingDate, status, image } = req.body;

  if (location) packingList.location = location;
  if (shipmentDate) packingList.shipmentDate = shipmentDate;
  if (packingDate) packingList.packingDate = packingDate;
  if (image) packingList.image = image;

  if (Array.isArray(items)) {
    packingList.items = await normalizeItems(companyId, items);
  }

  if (status && ['pending', 'approved', 'shipped', 'rejected'].includes(status)) {
    packingList.status = status;
    if (['approved', 'shipped'].includes(status) && req.user) {
      packingList.approvedBy = new Types.ObjectId(req.user.id);
      packingList.approvedAt = new Date();
    }
  }

  await packingList.save();

  return respond(res, StatusCodes.OK, packingList, { message: 'Packing list updated successfully' });
});

