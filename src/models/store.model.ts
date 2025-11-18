import { Schema, model, type Document, type Types } from 'mongoose';

export interface StoreDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  name: string;
  code: string;
  type: 'Central Store' | 'Branch Store';
  parent?: Types.ObjectId;
  manager?: Types.ObjectId;
  phone?: string;
  email?: string;
  address?: string;
  // Detailed address fields
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  // Financial information fields
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  ibanCode?: string;
  // Tax information
  taxCode?: string;
  // Additional configuration
  directPurchaseAllowed?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<StoreDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    type: { type: String, enum: ['Central Store', 'Branch Store'], required: true, default: 'Branch Store' },
    parent: { type: Schema.Types.ObjectId, ref: 'Store' },
    manager: { type: Schema.Types.ObjectId, ref: 'User' },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    // Detailed address fields
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
    // Financial information fields
    bankName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    ibanCode: { type: String, trim: true },
    // Tax information
    taxCode: { type: String, trim: true },
    // Additional configuration
    directPurchaseAllowed: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

storeSchema.index({ company: 1, code: 1 }, { unique: true });
storeSchema.index({ company: 1, name: 1 });
storeSchema.index({ company: 1, parent: 1 });

export const Store = model<StoreDocument>('Store', storeSchema);