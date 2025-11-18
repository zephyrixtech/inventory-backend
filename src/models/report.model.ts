import { Schema, model, type Document, type Types } from 'mongoose';

export interface ReportDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  reportType: string;
  details: Record<string, unknown>;
  generatedBy: Types.ObjectId;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<ReportDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    reportType: { type: String, required: true, trim: true },
    details: { type: Schema.Types.Mixed, required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    generatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

reportSchema.index({ company: 1, reportType: 1, generatedAt: -1 });

export const Report = model<ReportDocument>('Report', reportSchema);

