import { Schema, model, type Document, type Types } from 'mongoose';

export interface VendorDocument extends Document {
  // Removed company field since we're removing company context
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditReport?: string;
  status: 'pending' | 'approved' | 'inactive';
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<VendorDocument>(
  {
    // Removed company field since we're removing company context
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    creditReport: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'inactive'], default: 'pending' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Removed company index since we're removing company context
// vendorSchema.index({ company: 1, name: 1 }, { unique: true });

export const Vendor = model<VendorDocument>('Vendor', vendorSchema);