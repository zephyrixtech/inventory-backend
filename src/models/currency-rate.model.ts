import { Schema, model, type Document, type Types } from 'mongoose';

export interface CurrencyRateDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  fromCurrency: 'INR' | 'AED';
  toCurrency: 'INR' | 'AED';
  rate: number;
  effectiveDate: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const currencyRateSchema = new Schema<CurrencyRateDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    fromCurrency: { type: String, enum: ['INR', 'AED'], required: true },
    toCurrency: { type: String, enum: ['INR', 'AED'], required: true },
    rate: { type: Number, required: true, min: 0 },
    effectiveDate: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true
  }
);

currencyRateSchema.index({ company: 1, fromCurrency: 1, toCurrency: 1 }, { unique: true });

export const CurrencyRate = model<CurrencyRateDocument>('CurrencyRate', currencyRateSchema);

