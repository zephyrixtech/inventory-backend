import { Schema, model, type Document, type Types } from 'mongoose';

export interface StoreStockDocument extends Document<Types.ObjectId> {
  company?: Types.ObjectId;
  product: Types.ObjectId;
  store?: Types.ObjectId;
  quantity: number;
  margin: number;
  currency: 'INR' | 'AED';
  unitPrice: number;
  updatedAt: Date;
  createdAt: Date;
  lastUpdatedBy?: Types.ObjectId;
  unitPriceAED: number;
  packingList?: Types.ObjectId;
  dpPrice?: number;
  exchangeRate?: number;
  finalPrice?: number;
}

const storeStockSchema = new Schema<StoreStockDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: false, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: false },
    quantity: { type: Number, required: true, min: 0 },
    margin: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ['INR', 'AED'], default: 'INR' },
    unitPrice: { type: Number, default: 0, min: 0 },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    unitPriceAED: { type: Number, default: 0, min: 0 },
    packingList: { type: Schema.Types.ObjectId, ref: 'PackingList' },
    dpPrice: { type: Number },
    exchangeRate: { type: Number },
    finalPrice: { type: Number },
  },
  {
    timestamps: true
  }
);

// storeStockSchema.index({ company: 1, store: 1, product: 1 }, { unique: true });

export const StoreStock = model<StoreStockDocument>('StoreStock', storeStockSchema);

