import { Schema, model, type Document, type Types } from 'mongoose';

export interface UserDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phone?: string;
  role: 'superadmin' | 'admin' | 'purchaser' | 'biller';
  status: 'active' | 'inactive' | 'locked';
  isActive: boolean;
  failedAttempts: number;
  avatarUrl?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
    role: { type: String, enum: ['superadmin', 'admin', 'purchaser', 'biller'], required: true },
    status: { type: String, enum: ['active', 'inactive', 'locked'], default: 'active' },
    isActive: { type: Boolean, default: true },
    failedAttempts: { type: Number, default: 0 },
    avatarUrl: { type: String, trim: true },
    lastLoginAt: { type: Date }
  },
  {
    timestamps: true
  }
);

userSchema.index({ company: 1, email: 1 });

export const User = model<UserDocument>('User', userSchema);

