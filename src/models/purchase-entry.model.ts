import { Schema, model, type Document, type Types } from 'mongoose';

export interface PurchaseEntryItem {
  item: Types.ObjectId;
  description?: string;
}

export interface PurchaseEntryDocument extends Document<Types.ObjectId> {
  purchaseCode: string;
  billNumber: string;
  date: Date;
  supplier: Types.ObjectId;
  items: PurchaseEntryItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes?: string;
  createdBy: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseEntryItemSchema = new Schema<PurchaseEntryItem>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    description: { type: String, trim: true }
  },
  { _id: false }
);

const purchaseEntrySchema = new Schema<PurchaseEntryDocument>(
  {
    purchaseCode: { type: String, required: true, trim: true, unique: true },
    billNumber: { type: String, required: true, trim: true },
    date: { type: Date, required: true, default: Date.now },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    items: { type: [purchaseEntryItemSchema], required: true, validate: [arrayLimit, 'At least one item is required'] },
    totalAmount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    balanceAmount: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

function arrayLimit(val: any[]) {
  return val.length > 0;
}

// Index for efficient querying
purchaseEntrySchema.index({ purchaseCode: 1 }, { unique: true });
purchaseEntrySchema.index({ date: -1 });
purchaseEntrySchema.index({ supplier: 1 });

export const PurchaseEntry = model<PurchaseEntryDocument>('PurchaseEntry', purchaseEntrySchema);