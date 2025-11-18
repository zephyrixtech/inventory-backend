import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Company } from '../models/company.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const getCompany = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const company = await Company.findById(companyId);

  if (!company) {
    throw ApiError.notFound('Company not found');
  }

  return respond(res, StatusCodes.OK, company);
});

export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const company = await Company.findById(companyId);

  if (!company) {
    throw ApiError.notFound('Company not found');
  }

  const {
    name,
    email,
    phone,
    description,
    address,
    city,
    state,
    country,
    postalCode,
    bankName,
    bankAccountNumber,
    ifscCode,
    ibanCode,
    currency,
    taxPercentage,
    purchaseOrderReport,
    salesReport,
    stockReport,
    emailRefreshToken,
    isEmailAuthenticated
  } = req.body;

  // Update basic information
  if (name !== undefined) company.name = name;
  if (email !== undefined) company.email = email;
  if (phone !== undefined) company.phone = phone;
  if (description !== undefined) company.description = description;
  if (currency !== undefined) company.currency = currency;
  if (taxPercentage !== undefined) company.taxPercentage = taxPercentage;

  // Update address
  if (address !== undefined) company.address = address;
  if (city !== undefined) company.city = city;
  if (state !== undefined) company.state = state;
  if (country !== undefined) company.country = country;
  if (postalCode !== undefined) company.postalCode = postalCode;

  // Update banking
  if (bankName !== undefined) company.bankName = bankName;
  if (bankAccountNumber !== undefined) company.bankAccountNumber = bankAccountNumber;
  if (ifscCode !== undefined) company.ifscCode = ifscCode;
  if (ibanCode !== undefined) company.ibanCode = ibanCode;

  // Update system settings
  if (emailRefreshToken !== undefined) company.emailRefreshToken = emailRefreshToken;
  if (isEmailAuthenticated !== undefined) company.isEmailAuthenticated = isEmailAuthenticated;

  // Update report configurations
  if (purchaseOrderReport !== undefined) {
    company.purchaseOrderReport = {
      paymentDetails: purchaseOrderReport.paymentDetails ?? purchaseOrderReport.payment_details ?? company.purchaseOrderReport?.paymentDetails,
      remarks: purchaseOrderReport.remarks ?? company.purchaseOrderReport?.remarks,
      reportFooter: purchaseOrderReport.reportFooter ?? purchaseOrderReport.report_footer ?? company.purchaseOrderReport?.reportFooter
    };
  }

  if (salesReport !== undefined) {
    company.salesReport = {
      paymentDetails: salesReport.paymentDetails ?? salesReport.payment_details ?? company.salesReport?.paymentDetails,
      remarks: salesReport.remarks ?? company.salesReport?.remarks,
      reportFooter: salesReport.reportFooter ?? salesReport.report_footer ?? company.salesReport?.reportFooter
    };
  }

  if (stockReport !== undefined) {
    company.stockReport = {
      paymentDetails: stockReport.paymentDetails ?? stockReport.payment_details ?? company.stockReport?.paymentDetails,
      remarks: stockReport.remarks ?? company.stockReport?.remarks,
      reportFooter: stockReport.reportFooter ?? stockReport.report_footer ?? company.stockReport?.reportFooter
    };
  }

  await company.save();

  return respond(res, StatusCodes.OK, company, { message: 'Company updated successfully' });
});

