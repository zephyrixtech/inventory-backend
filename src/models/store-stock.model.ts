import { Schema, model, type Document, type Types } from 'mongoose';

export interface StoreStockDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  product: Types.ObjectId;
  store?: Types.ObjectId;
  quantity: number;
  margin: number;
  currency: 'INR' | 'AED';
  priceAfterMargin: number;
  updatedAt: Date;
  createdAt: Date;
  lastUpdatedBy?: Types.ObjectId;
}

const storeStockSchema = new Schema<StoreStockDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: false },
    quantity: { type: Number, required: true, min: 0 },
    margin: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ['INR', 'AED'], default: 'INR' },
    priceAfterMargin: { type: Number, default: 0, min: 0 },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true
  }
);

storeStockSchema.index({ company: 1, product: 1, store: 1 }, { unique: true });

export const StoreStock = model<StoreStockDocument>('StoreStock', storeStockSchema);

