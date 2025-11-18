import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Customer } from '../models/customer.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {
    company: companyId
  };

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
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const customer = await Customer.findOne({ _id: req.params.id, company: companyId });

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  return respond(res, StatusCodes.OK, customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { customerId, name, email, phone, contactPerson, status, taxNumber, billingAddress, shippingAddress } = req.body;

  const existing = await Customer.findOne({ company: companyId, customerId });
  if (existing) {
    throw ApiError.conflict('Customer with this ID already exists');
  }

  const customer = await Customer.create({
    company: companyId,
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
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const customer = await Customer.findOne({ _id: req.params.id, company: companyId });

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  const { name, email, phone, contactPerson, status, taxNumber, billingAddress, shippingAddress, isActive } = req.body;

  if (name) customer.name = name;
  if (email) customer.email = email;
  if (phone) customer.phone = phone;
  if (contactPerson) customer.contactPerson = contactPerson;
  if (status) customer.status = status;
  if (taxNumber) customer.taxNumber = taxNumber;
  if (billingAddress) customer.billingAddress = billingAddress;
  if (shippingAddress) customer.shippingAddress = shippingAddress;
  if (typeof isActive === 'boolean') customer.isActive = isActive;

  await customer.save();

  return respond(res, StatusCodes.OK, customer, { message: 'Customer updated successfully' });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const customer = await Customer.findOne({ _id: req.params.id, company: companyId });

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  customer.isActive = false;
  customer.status = 'Inactive';
  await customer.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Customer deactivated successfully' });
});

