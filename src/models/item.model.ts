import { Schema, model, type Document, type Types } from 'mongoose';

export type ItemStatus = 'draft' | 'pending_qc' | 'qc_passed' | 'qc_failed' | 'store_pending' | 'store_approved' | 'store_rejected' | 'archived';

export interface ItemDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  name: string;
  code: string;
  category: Types.ObjectId;
  description?: string;
  reorderLevel?: number;
  maxLevel?: number;
  unitOfMeasure?: string;
  vendor?: Types.ObjectId;
  unitPrice?: number;
  currency?: 'INR' | 'AED';
  quantity?: number;
  totalPrice?: number;
  purchaseDate?: Date;
  status: ItemStatus;
  qcStatus?: 'pending' | 'approved' | 'rejected';
  qcRemarks?: string;
  qcCheckedAt?: Date;
  qcCheckedBy?: Types.ObjectId;
  storeApprovedAt?: Date;
  storeApprovedBy?: Types.ObjectId;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ItemDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, trim: true },
    reorderLevel: { type: Number, default: 0, min: 0 },
    maxLevel: { type: Number, default: 0, min: 0 },
    unitOfMeasure: { type: String, trim: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    unitPrice: { type: Number, min: 0 },
    currency: { type: String, enum: ['INR', 'AED'], default: 'INR' },
    quantity: { type: Number, min: 0 },
    totalPrice: { type: Number, min: 0 },
    purchaseDate: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'pending_qc', 'qc_passed', 'qc_failed', 'store_pending', 'store_approved', 'store_rejected', 'archived'],
      default: 'draft'
    },
    qcStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    qcRemarks: { type: String, trim: true },
    qcCheckedAt: { type: Date },
    qcCheckedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    storeApprovedAt: { type: Date },
    storeApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true
  }
);

itemSchema.index({ company: 1, code: 1 }, { unique: true });
itemSchema.index({ company: 1, name: 1 });
itemSchema.index({ company: 1, status: 1 });

itemSchema.pre('save', function (next) {
  if (typeof this.quantity === 'number' && typeof this.unitPrice === 'number') {
    this.totalPrice = this.quantity * this.unitPrice;
  }
  next();
});

export const Item = model<ItemDocument>('Item', itemSchema);

