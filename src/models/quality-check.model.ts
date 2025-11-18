import { Schema, model, type Document, type Types } from 'mongoose';

export interface QualityCheckDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  product: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  checkedBy: Types.ObjectId;
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const qualityCheckSchema = new Schema<QualityCheckDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Item', required: true, unique: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    remarks: { type: String, trim: true },
    checkedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    checkedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

qualityCheckSchema.index({ company: 1, product: 1 }, { unique: true });

export const QualityCheck = model<QualityCheckDocument>('QualityCheck', qualityCheckSchema);

