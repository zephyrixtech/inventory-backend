import { Schema, model, type Document, type Types } from 'mongoose';

export interface CategoryDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  subCategory?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    subCategory: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

categorySchema.index({ company: 1, name: 1 }, { unique: true });

export const Category = model<CategoryDocument>('Category', categorySchema);