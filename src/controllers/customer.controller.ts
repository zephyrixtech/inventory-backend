import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Customer } from '../models/customer.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};
  // Removed company filter since we're removing company context

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { customerId: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];
  }

  const query = Customer.find(filters);

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [customers, total] = await Promise.all([query.exec(), Customer.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, customers, buildPaginationMeta(page, limit, total));
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  return respond(res, StatusCodes.OK, customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { customerId, name, email, phone, contactPerson, status, taxNumber, billingAddress, shippingAddress } = req.body;

  const existing = await Customer.findOne({ customerId });
  if (existing) {
    throw ApiError.conflict('Customer with this ID already exists');
  }

  const customer = await Customer.create({
    // Removed company field since we're removing company context
    customerId,
    name,
    email,
    phone,
    contactPerson,
    status,
    taxNumber,
    billingAddress,
    shippingAddress
  });

  return respond(res, StatusCodes.CREATED, customer, { message: 'Customer created successfully' });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  const updates: Record<string, unknown> = {};
  const { customerId, name, email, phone, contactPerson, status, taxNumber, billingAddress, shippingAddress } = req.body;

  if (customerId !== undefined) updates.customerId = customerId;
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (contactPerson !== undefined) updates.contactPerson = contactPerson;
  if (status !== undefined) updates.status = status;
  if (taxNumber !== undefined) updates.taxNumber = taxNumber;
  if (billingAddress !== undefined) updates.billingAddress = billingAddress;
  if (shippingAddress !== undefined) updates.shippingAddress = shippingAddress;

  Object.assign(customer, updates);
  await customer.save();

  return respond(res, StatusCodes.OK, customer, { message: 'Customer updated successfully' });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  await Customer.deleteOne({ _id: customer._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Customer deleted successfully' });
});