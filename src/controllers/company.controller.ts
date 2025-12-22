import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Company } from '../models/company.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const getCompany = asyncHandler(async (req: Request, res: Response) => {
  // Since we're removing company context, we'll return a default company or create one if none exists
  let company = await Company.findOne({ isActive: true });
  
  // If no company exists, create a default one
  if (!company) {
    company = await Company.create({
      name: 'AL LIBAS GENERAL TRADING L L C',
      description: 'SHOP NO 5',
      address: 'STANDARD HOMES REAL ESTATE BUILDING',
      city: 'AJMAN',
      state: 'INDUSTRIAL AREA 2',
      country: 'UNITED ARAB EMIRATES',
      postalCode: 'P.O.BOX :4381',
      phone: '+971-55-680-5858 / +971-55-918-7607',
      email: 'allibastrading@gmail.com',
      currency: 'AED',
      taxPercentage: 5,
      bankName: 'RAKBANK',
      bankAccountNumber: '0192594853001',
      ibanCode: 'AE790400000192594853001',
      code: 'ALIBAS',
      isActive: true
    });
  }

  return respond(res, StatusCodes.OK, company);
});

export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
  // Since we're removing company context, we'll update the first available company or create one
  let company = await Company.findOne({ isActive: true });
  
  // If no company exists, create a default one
  if (!company) {
    company = await Company.create({
      name: 'AL LIBAS GENERAL TRADING L L C',
      description: 'SHOP NO 5',
      address: 'STANDARD HOMES REAL ESTATE BUILDING',
      city: 'AJMAN',
      state: 'INDUSTRIAL AREA 2',
      country: 'UNITED ARAB EMIRATES',
      postalCode: 'P.O.BOX :4381',
      phone: '+971-55-680-5858 / +971-55-918-7607',
      email: 'allibastrading@gmail.com',
      currency: 'AED',
      taxPercentage: 5,
      bankName: 'RAKBANK',
      bankAccountNumber: '0192594853001',
      ibanCode: 'AE790400000192594853001',
      code: 'ALIBAS',
      isActive: true
    });
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

  // Update reports
  if (purchaseOrderReport !== undefined) company.purchaseOrderReport = purchaseOrderReport;
  if (salesReport !== undefined) company.salesReport = salesReport;
  if (stockReport !== undefined) company.stockReport = stockReport;

  // Update email settings
  if (emailRefreshToken !== undefined) company.emailRefreshToken = emailRefreshToken;
  if (isEmailAuthenticated !== undefined) company.isEmailAuthenticated = isEmailAuthenticated;

  await company.save();

  return respond(res, StatusCodes.OK, company, { message: 'Company updated successfully' });
});