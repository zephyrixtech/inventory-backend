import { Schema, model, type Document, type Types } from 'mongoose';

export interface PackingListItem {
  product: Types.ObjectId;
  quantity: number;
}

export interface PackingListDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
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
  status: 'pending' | 'in_transit' | 'approved' | 'shipped' | 'rejected';
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const packingListItemSchema = new Schema<PackingListItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const packingListSchema = new Schema<PackingListDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
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
    status: { type: String, enum: ['pending', 'in_transit', 'approved', 'shipped', 'rejected'], default: 'pending' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

packingListSchema.index({ company: 1, boxNumber: 1 }, { unique: true });

packingListSchema.pre('save', function (next) {
  this.totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  next();
});

export const PackingList = model<PackingListDocument>('PackingList', packingListSchema);