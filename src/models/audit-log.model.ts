import { Schema, model, type Document, type Types } from 'mongoose';

export interface AuditLogDocument extends Document {
  user?: Types.ObjectId;
  actionBy: string;
  role: string;
  scope: string;
  module: string;
  key: string;
  log: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  location: string;
  transactionDate: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    actionBy: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    scope: { type: String, required: true, trim: true, index: true },
    module: { type: String, required: true, trim: true, index: true },
    key: { type: String, required: true, trim: true, index: true },
    log: { type: String, required: true, trim: true },
    ipAddress: { type: String, required: true, trim: true },
    userAgent: { type: String, required: true, trim: true },
    device: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    transactionDate: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: false
  }
);

// Index for compound query efficiency
auditLogSchema.index({ transactionDate: -1 });

export const AuditLog = model<AuditLogDocument>('AuditLog', auditLogSchema);
