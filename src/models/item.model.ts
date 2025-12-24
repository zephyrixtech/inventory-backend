import { Schema, model, type Document, type Types } from 'mongoose';

export type ItemStatus =
  | 'draft'
  | 'pending_qc'
  | 'qc_passed'
  | 'qc_failed'
  | 'store_pending'
  | 'store_approved'
  | 'store_rejected'
  | 'archived';

export interface ItemDocument extends Document {
  _id: Types.ObjectId;
  // Removed company field since we're removing company context
  name: string;
  code: string; // This will be auto-generated if not provided
  billNumber: string; // Changed from category to billNumber
  description?: string;
  unitOfMeasure?: string;
  vendor?: Types.ObjectId;
  unitPrice?: number;
  currency?: 'INR' | 'AED';

  // Quantity fields
  quantity?: number; // Total quantity
  damagedQuantity?: number; // Damaged quantity from QC
  availableQuantity?: number; // Stored field: quantity - damagedQuantity

  totalPrice?: number;
  purchaseDate?: Date;
  status: ItemStatus;

  // QC fields
  qcStatus?: 'pending' | 'approved' | 'rejected';
  qcRemarks?: string;
  qcCheckedAt?: Date;
  qcCheckedBy?: Types.ObjectId;
  qcCheckedByName?: string;
  inspectorName?: string;
  qcSubmittedBy?: Types.ObjectId;
  qcSubmittedByName?: string;

  // Store approval fields
  storeApprovedAt?: Date;
  storeApprovedBy?: Types.ObjectId;

  // Additional fields
  additionalAttributes?: Record<string, any>;
  videoType?: 'upload' | 'youtube';
  youtubeLink?: string | null;
  videoUrl?: string | null;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ItemDocument>(
  {
    // Removed company field since we're removing company context
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      trim: true
    },
    billNumber: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    unitOfMeasure: {
      type: String,
      trim: true
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier'
    },
    unitPrice: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      enum: ['INR', 'AED'],
      default: 'INR'
    },

    // NEW: Quantity fields (optional, keeping current logic)
    quantity: {
      type: Number,
      min: 0
    },
    damagedQuantity: {
      type: Number,
      min: 0,
      default: 0
    },
    availableQuantity: {
      type: Number,
      default: 0
    },

    totalPrice: {
      type: Number,
      min: 0
    },
    purchaseDate: {
      type: Date
    },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_qc',
        'qc_passed',
        'qc_failed',
        'store_pending',
        'store_approved',
        'store_rejected',
        'archived'
      ],
      default: 'draft'
    },

    // QC fields
    qcStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    qcRemarks: {
      type: String,
      trim: true
    },
    qcCheckedAt: {
      type: Date
    },
    qcCheckedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    qcCheckedByName: {
      type: String,
      trim: true
    },
    inspectorName: {
      type: String,
      trim: true
    },
    qcSubmittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    qcSubmittedByName: {
      type: String,
      trim: true
    },

    // Store approval fields
    storeApprovedAt: {
      type: Date
    },
    storeApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    // Additional fields
    additionalAttributes: {
      type: Schema.Types.Mixed,
      default: {}
    },
    videoType: {
      type: String,
      enum: ['upload', 'youtube'],
      default: 'upload'
    },
    youtubeLink: {
      type: String,
      trim: true
    },
    videoUrl: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Removed company indexes since we're removing company context
// itemSchema.index({ company: 1, code: 1 }, { unique: true });
// itemSchema.index({ company: 1, name: 1 });
// itemSchema.index({ company: 1, status: 1 });

// Existing pre-save hook (keep as is)
itemSchema.pre('save', function (next) {
  if (typeof this.quantity === 'number' && typeof this.unitPrice === 'number') {
    this.totalPrice = this.quantity * this.unitPrice;
  }
  next();
});

export const Item = model<ItemDocument>('Item', itemSchema);