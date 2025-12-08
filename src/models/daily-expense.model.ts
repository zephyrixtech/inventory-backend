import { Schema, model, type Document, type Types } from 'mongoose';
import { Supplier } from './supplier.model';

export interface DailyExpenseDocument extends Document<Types.ObjectId> {
  supplier?: Types.ObjectId;
  description: string;
  amount: number;
  date: Date;
  type: 'purchase' | 'petty';
  paymentType?: 'cash' | 'card' | 'upi';
  transactionId?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dailyExpenseSchema = new Schema<DailyExpenseDocument>(
  {
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    type: { type: String, required: true, enum: ['purchase', 'petty'] },
    paymentType: { type: String, enum: ['cash', 'card', 'upi'] },
    transactionId: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true
  }
);

export const DailyExpense = model<DailyExpenseDocument>('DailyExpense', dailyExpenseSchema);