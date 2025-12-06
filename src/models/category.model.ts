import { Schema, model, type Document, type Types } from 'mongoose';

export interface CategoryDocument extends Document {
  // Removed company field since we're removing company context
  name: string;
  description?: string;
  isActive: boolean;
  subCategory?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDocument>(
  {
    // Removed company field since we're removing company context
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    subCategory: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

// Removed company index since we're removing company context
// categorySchema.index({ company: 1, name: 1 }, { unique: true });

export const Category = model<CategoryDocument>('Category', categorySchema);