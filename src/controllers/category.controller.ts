import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types, type FilterQuery } from 'mongoose';

import { Category, type CategoryDocument } from '../models/category.model';
import { Item } from '../models/item.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

const serializeCategory = (category: CategoryDocument, itemsCount = 0) => ({
  id: category._id,
  _id: category._id,
  name: category.name,
  description: category.description ?? '',
  isActive: category.isActive,
  subCategory: category.subCategory ?? '',
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
  itemsCount
});

const ensureNoLinkedItems = async (companyId: string, categoryId: Types.ObjectId) => {
  const linkedItem = await Item.exists({
    company: new Types.ObjectId(companyId),
    category: categoryId,
    isActive: true
  });

  if (linkedItem) {
    throw ApiError.conflict('Cannot modify category. Items are associated with this category.');
  }
};

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: FilterQuery<CategoryDocument> = {
    company: new Types.ObjectId(companyId)
  };

  if (status && status !== 'all') {
    filters.isActive = status === 'active';
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const regex = new RegExp(search.trim(), 'i');
    filters.$or = [{ name: regex }, { description: regex }, { subCategory: regex }];
  }

  const allowedSortFields: Record<string, keyof CategoryDocument> = {
    name: 'name',
    description: 'description',
    status: 'isActive',
    subCategory: 'subCategory',
    createdAt: 'createdAt'
  };
  const resolvedSortField = sortBy && allowedSortFields[sortBy] ? allowedSortFields[sortBy] : 'createdAt';

  const query = Category.find(filters)
    .sort({ [resolvedSortField]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const [categories, total] = await Promise.all([query.exec(), Category.countDocuments(filters)]);

  const categoryIds = categories.map(category => category._id);
  let counts: Record<string, number> = {};

  if (categoryIds.length > 0) {
    const aggregation = await Item.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          company: new Types.ObjectId(companyId),
          category: { $in: categoryIds },
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    counts = aggregation.reduce<Record<string, number>>((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});
  }

  const data = categories.map(category => serializeCategory(category, counts[category._id.toString()] ?? 0));

  return respond(res, StatusCodes.OK, data, buildPaginationMeta(page, limit, total));
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const category = await Category.findOne({ _id: req.params.id, company: new Types.ObjectId(companyId) });

  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  const itemsCount = await Item.countDocuments({
    company: new Types.ObjectId(companyId),
    category: category._id,
    isActive: true
  });

  return respond(res, StatusCodes.OK, serializeCategory(category, itemsCount));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { name, description, isActive, subCategory } = req.body;

  const existing = await Category.findOne({ company: new Types.ObjectId(companyId), name });
  if (existing) {
    throw ApiError.conflict('Category with this name already exists');
  }

  const category = await Category.create({
    company: new Types.ObjectId(companyId),
    name,
    description,
    subCategory,
    isActive: typeof isActive === 'boolean' ? isActive : true
  });

  return respond(res, StatusCodes.CREATED, serializeCategory(category), { message: 'Category created successfully' });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const category = await Category.findOne({ _id: req.params.id, company: new Types.ObjectId(companyId) });

  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  const { name, description, isActive, subCategory } = req.body;

  if (name) category.name = name;
  if (typeof description === 'string') category.description = description;
  if (typeof subCategory === 'string') category.subCategory = subCategory;

  if (typeof isActive === 'boolean' && category.isActive && !isActive) {
    await ensureNoLinkedItems(companyId.toString(), category._id);
    category.isActive = false;
  } else if (typeof isActive === 'boolean') {
    category.isActive = isActive;
  }

  await category.save();

  const itemsCount = await Item.countDocuments({
    company: new Types.ObjectId(companyId),
    category: category._id,
    isActive: true
  });

  return respond(res, StatusCodes.OK, serializeCategory(category, itemsCount), { message: 'Category updated successfully' });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const category = await Category.findOne({ _id: req.params.id, company: new Types.ObjectId(companyId) });

  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  await ensureNoLinkedItems(companyId.toString(), category._id);

  category.isActive = false;
  await category.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Category deactivated successfully' });
});