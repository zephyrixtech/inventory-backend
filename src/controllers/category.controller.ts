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

const ensureNoLinkedItems = async (categoryId: Types.ObjectId) => {
  // Since we removed category field from items, no items are linked to categories anymore
  // This function can be simplified or removed entirely
  return; // No items are linked to categories anymore
};

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: FilterQuery<CategoryDocument> = {};
  // Removed company filter since we're removing company context

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
  
  // Ensure sortBy is a string and exists in allowedSortFields
  const sortField = typeof sortBy === 'string' ? sortBy : '';
  const resolvedSortField = sortField && allowedSortFields[sortField] ? allowedSortFields[sortField] : 'createdAt';
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

  const data = categories.map(category => {
    // Ensure category._id is treated as a string for indexing
    const categoryIdStr = (category._id as Types.ObjectId).toString();
    return serializeCategory(category, counts[categoryIdStr] ?? 0);
  });

  return respond(res, StatusCodes.OK, data, buildPaginationMeta(page, limit, total));
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const categoryId = typeof req.params.id === 'string' ? req.params.id : '';
  const category = await Category.findById(categoryId);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  const itemsCount = await Item.countDocuments({
    category: category._id as Types.ObjectId,
    isActive: true
  });

  return respond(res, StatusCodes.OK, serializeCategory(category, itemsCount));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { name, description, isActive, subCategory } = req.body;

  const existing = await Category.findOne({ name });
  if (existing) {
    throw ApiError.conflict('Category with this name already exists');
  }

  const category = await Category.create({
    // Removed company field since we're removing company context
    name,
    description,
    subCategory,
    isActive: typeof isActive === 'boolean' ? isActive : true
  });

  return respond(res, StatusCodes.CREATED, serializeCategory(category), { message: 'Category created successfully' });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const categoryId = typeof req.params.id === 'string' ? req.params.id : '';
  const category = await Category.findById(categoryId);

  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  const { name, description, isActive, subCategory } = req.body;

  if (name) category.name = name;
  if (typeof description === 'string') category.description = description;
  if (typeof subCategory === 'string') category.subCategory = subCategory;

  if (typeof isActive === 'boolean' && category.isActive && !isActive) {
    // Cast category._id to Types.ObjectId to satisfy the function parameter type
    await ensureNoLinkedItems(category._id as Types.ObjectId);
    category.isActive = false;
  } else if (typeof isActive === 'boolean') {
    category.isActive = isActive;
  }

  await category.save();

  const itemsCount = await Item.countDocuments({
    category: category._id as Types.ObjectId,
    isActive: true
  });

  return respond(res, StatusCodes.OK, serializeCategory(category, itemsCount), { message: 'Category updated successfully' });
});
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const categoryId = typeof req.params.id === 'string' ? req.params.id : '';
  const category = await Category.findById(categoryId);

  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  await ensureNoLinkedItems(category._id as Types.ObjectId);

  await Category.deleteOne({ _id: category._id as Types.ObjectId });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Category deleted successfully' });
});