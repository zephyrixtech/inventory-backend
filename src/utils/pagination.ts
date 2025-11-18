import type { Request } from 'express';
import type mongoose from 'mongoose';

export type PaginationParams = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export const getPaginationParams = (req: Request): PaginationParams => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined;
  const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';

  return { page, limit, sortBy, sortOrder };
};

export const paginateQuery = <T>(query: mongoose.Query<T[], T>, { page, limit, sortBy, sortOrder }: PaginationParams) => {
  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  }
  return query.skip((page - 1) * limit).limit(limit);
};

