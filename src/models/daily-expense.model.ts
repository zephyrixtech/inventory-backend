import { Schema, model, type Document, type Types } from 'mongoose';

export interface DailyExpenseDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  product: Types.ObjectId;
  description: string;
  amount: number;
  date: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dailyExpenseSchema = new Schema<DailyExpenseDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true
  }
);

dailyExpenseSchema.index({ company: 1, date: 1 });

export const DailyExpense = model<DailyExpenseDocument>('DailyExpense', dailyExpenseSchema);

