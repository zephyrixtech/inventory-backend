import { Schema, model, type Document, type Types } from 'mongoose';

export interface CompanyDocument extends Document<Types.ObjectId> {
  // Basic Information
  name: string;
  code: string;
  currency: string;
  email?: string;
  phone?: string;
  description?: string;
  
  // Address & Banking
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  ibanCode?: string;
  
  // System Settings
  emailRefreshToken?: string;
  isEmailAuthenticated?: boolean;
  taxPercentage?: number;
  
  // Report Customization
  purchaseOrderReport?: {
    paymentDetails?: string;
    remarks?: string;
    reportFooter?: string;
  };
  salesReport?: {
    paymentDetails?: string;
    remarks?: string;
    reportFooter?: string;
  };
  stockReport?: {
    paymentDetails?: string;
    remarks?: string;
    reportFooter?: string;
  };
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<CompanyDocument>(
  {
    // Basic Information
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    currency: { type: String, required: true, uppercase: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    description: { type: String, trim: true },
    
    // Address & Banking
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    bankName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    ibanCode: { type: String, trim: true },
    
    // System Settings
    emailRefreshToken: { type: String, trim: true },
    isEmailAuthenticated: { type: Boolean, default: false },
    taxPercentage: { type: Number, min: 0, max: 100 },
    
    // Report Customization
    purchaseOrderReport: {
      paymentDetails: { type: String, trim: true },
      remarks: { type: String, trim: true },
      reportFooter: { type: String, trim: true }
    },
    salesReport: {
      paymentDetails: { type: String, trim: true },
      remarks: { type: String, trim: true },
      reportFooter: { type: String, trim: true }
    },
    stockReport: {
      paymentDetails: { type: String, trim: true },
      remarks: { type: String, trim: true },
      reportFooter: { type: String, trim: true }
    },
    
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

export const Company = model<CompanyDocument>('Company', companySchema);