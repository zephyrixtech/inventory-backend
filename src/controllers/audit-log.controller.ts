import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { AuditLog } from '../models/audit-log.model';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { scope, search, dateFrom, dateTo } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, any> = {};

  if (scope && scope !== 'all') {
    filters.scope = scope;
  }

  // Handle date filters (dateFrom & dateTo)
  if (dateFrom || dateTo) {
    filters.transactionDate = {};
    if (dateFrom && typeof dateFrom === 'string') {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filters.transactionDate.$gte = fromDate;
    }
    if (dateTo && typeof dateTo === 'string') {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filters.transactionDate.$lte = toDate;
    }
  }

  // Handle search term (match log content, actionBy, scope, module, or key)
  if (search && typeof search === 'string') {
    const searchRegex = new RegExp(search, 'i');
    filters.$or = [
      { log: searchRegex },
      { actionBy: searchRegex },
      { scope: searchRegex },
      { module: searchRegex },
      { key: searchRegex }
    ];
  }

  const query = AuditLog.find(filters);

  // Sorting
  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ transactionDate: -1 });
  }

  // Pagination
  query.skip((page - 1) * limit).limit(limit);

  const [logs, total] = await Promise.all([
    query.exec(),
    AuditLog.countDocuments(filters)
  ]);

  return respond(res, StatusCodes.OK, logs, buildPaginationMeta(page, limit, total));
});
