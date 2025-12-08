import { Schema, model, type Document, type Types } from 'mongoose';

export interface CustomerDocument extends Document<Types.ObjectId> {
  // Removed company field since we're removing company context
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  status: 'Active' | 'Inactive';
  isActive: boolean;
  taxNumber?: string;
  billingAddress?: string;
  shippingAddress?: string;
  creditLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerDocument>(
  {
    // Removed company field since we're removing company context
    customerId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isActive: { type: Boolean, default: true },
    taxNumber: { type: String, trim: true },
    billingAddress: { type: String, trim: true },
    shippingAddress: { type: String, trim: true },
    creditLimit: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

// Removed company indexes since we're removing company context
// customerSchema.index({ company: 1, customerId: 1 }, { unique: true });
// customerSchema.index({ company: 1, name: 1 });

export const Customer = model<CustomerDocument>('Customer', customerSchema);