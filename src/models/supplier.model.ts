import { Schema, model, type Document, type Types } from 'mongoose';

export interface SupplierDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  supplierId: string;
  name: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  creditReport?: string;
  address?: string;
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  createdBy?: Types.ObjectId;
  // Additional fields
  registrationNumber?: string;
  taxId?: string;
  website?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  bankName?: string;
  bank_account_number?: string;
  ifscCode?: string;
  ibanCode?: string;
  creditLimit?: number;
  paymentTerms?: string;
  description?: string;
  rating?: number;
  notes?: string;
  selectedBrands?: string[];
  selectedSupplies?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<SupplierDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    supplierId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    creditReport: { type: String, trim: true },
    address: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // Additional fields
    registrationNumber: { type: String, trim: true },
    taxId: { type: String, trim: true },
    website: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
    bankName: { type: String, trim: true },
    bank_account_number: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    ibanCode: { type: String, trim: true },
    creditLimit: { type: Number },
    paymentTerms: { type: String, trim: true },
    description: { type: String, trim: true },
    rating: { type: Number },
    notes: { type: String, trim: true },
    selectedBrands: [{ type: String }],
    selectedSupplies: [{ type: String }]
  },
  {
    timestamps: true
  }
);

supplierSchema.index({ company: 1, supplierId: 1 }, { unique: true });

export const Supplier = model<SupplierDocument>('Supplier', supplierSchema);