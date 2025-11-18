import { Schema, model, type Document, type Types } from 'mongoose';

export interface RoleDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  name: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

roleSchema.index({ company: 1, name: 1 }, { unique: true });

export const Role = model<RoleDocument>('Role', roleSchema);

