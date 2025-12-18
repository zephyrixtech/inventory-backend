import { Schema, model, type Document, type Types } from 'mongoose';

export interface StoreDocument extends Document<Types.ObjectId> {
  company?: Types.ObjectId;
  name: string;
  code: string;
  manager?: string;
  purchaser?: string;
  biller?: string;
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<StoreDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: false, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    manager: { type: String },
    purchaser: { type: String },
    biller: { type: String },
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
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

// storeSchema.index({ company: 1, code: 1 }, { unique: true });
// storeSchema.index({ company: 1, name: 1 });

export const Store = model<StoreDocument>('Store', storeSchema);