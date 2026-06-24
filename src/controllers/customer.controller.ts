import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Customer } from '../models/customer.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';
import { logAudit } from '../utils/audit-logger';

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

  await logAudit(req, 'Customer Management', 'Customer View', customer.customerId || customer.name, `Viewed customer "${customer.name}".`);

  return respond(res, StatusCodes.OK, customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { customerId, name, email, phone, contactPerson, status, taxNumber, billingAddress, shippingAddress, creditLimit } = req.body;

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
    shippingAddress,
    creditLimit
  });

  await logAudit(
    req,
    'Customer Management',
    'Customer Creation',
    customer.customerId || customer.name,
    `Created customer "${customer.name}" with ID "${customer.customerId}".`
  );

  return respond(res, StatusCodes.CREATED, customer, { message: 'Customer created successfully' });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  const updates: Record<string, unknown> = {};
  const { customerId, name, email, phone, contactPerson, status, taxNumber, billingAddress, shippingAddress, creditLimit } = req.body;

  const changedFields: string[] = [];
  if (customerId !== undefined && customerId !== customer.customerId) {
    changedFields.push(`customerId: "${customer.customerId}" -> "${customerId}"`);
    updates.customerId = customerId;
  }
  if (name !== undefined && name !== customer.name) {
    changedFields.push(`name: "${customer.name}" -> "${name}"`);
    updates.name = name;
  }
  if (email !== undefined && email !== customer.email) {
    changedFields.push(`email: "${customer.email || ''}" -> "${email}"`);
    updates.email = email;
  }
  if (phone !== undefined && phone !== customer.phone) {
    changedFields.push(`phone: "${customer.phone || ''}" -> "${phone}"`);
    updates.phone = phone;
  }
  if (contactPerson !== undefined && contactPerson !== customer.contactPerson) {
    changedFields.push(`contactPerson: "${customer.contactPerson || ''}" -> "${contactPerson}"`);
    updates.contactPerson = contactPerson;
  }
  if (status !== undefined && status !== customer.status) {
    changedFields.push(`status: "${customer.status}" -> "${status}"`);
    updates.status = status;
  }
  if (taxNumber !== undefined && taxNumber !== customer.taxNumber) {
    changedFields.push(`taxNumber: "${customer.taxNumber || ''}" -> "${taxNumber}"`);
    updates.taxNumber = taxNumber;
  }
  if (billingAddress !== undefined && billingAddress !== customer.billingAddress) {
    changedFields.push(`billingAddress: updated`);
    updates.billingAddress = billingAddress;
  }
  if (shippingAddress !== undefined && shippingAddress !== customer.shippingAddress) {
    changedFields.push(`shippingAddress: updated`);
    updates.shippingAddress = shippingAddress;
  }
  if (creditLimit !== undefined && creditLimit !== customer.creditLimit) {
    changedFields.push(`creditLimit: ${customer.creditLimit || 0} -> ${creditLimit}`);
    updates.creditLimit = creditLimit;
  }

  Object.assign(customer, updates);
  await customer.save();

  if (changedFields.length > 0) {
    await logAudit(
      req,
      'Customer Management',
      'Customer Update',
      customer.customerId || customer.name,
      `Updated customer "${customer.name}": ${changedFields.join(', ')}.`
    );
  }

  return respond(res, StatusCodes.OK, customer, { message: 'Customer updated successfully' });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  await Customer.deleteOne({ _id: customer._id });

  await logAudit(
    req,
    'Customer Management',
    'Customer Deletion',
    customer.customerId || customer.name,
    `Deleted customer "${customer.name}" (ID: ${customer.customerId}).`
  );

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Customer deleted successfully' });
});