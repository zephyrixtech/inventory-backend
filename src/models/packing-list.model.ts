import { Schema, model, type Document, type Types } from 'mongoose';

export interface PackingListItem {
  product: Types.ObjectId;
  quantity: number;
  description?: string;
  unitOfMeasure?: string;
}

export interface PackingListDocument extends Document<Types.ObjectId> {
  company?: Types.ObjectId;
  boxNumber: string;
  items: PackingListItem[];
  totalQuantity: number;
  image1?: string;
  image2?: string;
  shipmentDate?: Date;
  packingDate?: Date;
  store?: Types.ObjectId;
  toStore?: Types.ObjectId;
  currency?: 'INR' | 'AED';
  exchangeRate?: number;
  status: 'pending' | 'in_transit' | 'approved' | 'shipped' | 'rejected' | 'india' | 'uae';
  approvalStatus: 'draft' | 'approved'; // New approval workflow field
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  // New fields
  cargoNumber?: string;
  fabricDetails?: string;
  createdAt: Date;
  updatedAt: Date;
  size?: string;
  description? :string;
}

const packingListItemSchema = new Schema<PackingListItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    unitOfMeasure: { type: String, trim: true }
  },
  { _id: false }
);

const packingListSchema = new Schema<PackingListDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    boxNumber: { type: String, required: true, trim: true },
    items: { type: [packingListItemSchema], default: [] },
    totalQuantity: { type: Number, default: 0, min: 0 },
    image1: { type: String },
    image2: { type: String },
    shipmentDate: { type: Date },
    packingDate: { type: Date },
    store: { type: Schema.Types.ObjectId, ref: 'Store' },
    toStore: { type: Schema.Types.ObjectId, ref: 'Store' },
    currency: { type: String, enum: ['INR', 'AED'], default: 'INR' },
    exchangeRate: { type: Number },
    status: { type: String, enum: ['pending', 'in_transit', 'approved', 'shipped', 'rejected', 'india', 'uae'], default: 'india' },
    approvalStatus: { type: String, enum: ['draft', 'approved'], default: 'draft' }, // New approval workflow field
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    // New fields
    cargoNumber: { type: String, trim: true },
    fabricDetails: { type: String, trim: true },
    size: { type: String, trim: true },
    description: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

// packingListSchema.index({ boxNumber: 1 }, { unique: true });

packingListSchema.pre('save', function (next) {
  this.totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  next();
});

export const PackingList = model<PackingListDocument>('PackingList', packingListSchema);