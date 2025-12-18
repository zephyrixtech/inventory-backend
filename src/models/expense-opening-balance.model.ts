import { Schema, model, type Document, type Types } from 'mongoose';

export interface ExpenseOpeningBalanceDocument extends Document<Types.ObjectId> {
  amount: number;
  description: string;
  date: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseOpeningBalanceSchema = new Schema<ExpenseOpeningBalanceDocument>(
  {
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, default: '' },
    date: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true
  }
);

// Only keep the latest opening balance record
expenseOpeningBalanceSchema.index({ createdAt: -1 });

export const ExpenseOpeningBalance = model<ExpenseOpeningBalanceDocument>(
  'ExpenseOpeningBalance',
  expenseOpeningBalanceSchema
);
