import { Schema, model, type Document, type Types } from 'mongoose';

export type StockTransferStatus = 'pending' | 'approved' | 'rejected';

export interface StockTransferDocument extends Document<Types.ObjectId> {
  fromStore: Types.ObjectId;
  toStore: Types.ObjectId;
  product: Types.ObjectId;
  quantity: number;
  status: StockTransferStatus;
  notes?: string;
  requestedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stockTransferSchema = new Schema<StockTransferDocument>(
  {
    fromStore: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    toStore: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    notes: { type: String, trim: true, maxlength: 500 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

stockTransferSchema.index({ fromStore: 1, toStore: 1, product: 1, status: 1, createdAt: -1 });

export const StockTransfer = model<StockTransferDocument>('StockTransfer', stockTransferSchema);

