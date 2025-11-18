import { Schema, model, type Document, type Types } from 'mongoose';

type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVER_COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'RECEIVED_PARTIAL'
  | 'RECEIVED_COMPLETE';

export interface PurchaseOrderItem {
  item: Types.ObjectId;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
}

export interface PurchaseOrderDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  poNumber: string;
  supplier: Types.ObjectId;
  orderDate: Date;
  expectedDate?: Date;
  status: PurchaseOrderStatus;
  totalValue: number;
  notes?: string;
  issuedBy: Types.ObjectId;
  isActive: boolean;
  items: PurchaseOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const purchaseOrderItemSchema = new Schema<PurchaseOrderItem>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    receivedQuantity: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<PurchaseOrderDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    poNumber: { type: String, required: true, trim: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    orderDate: { type: Date, default: Date.now },
    expectedDate: { type: Date },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVER_COMPLETED',
        'REJECTED',
        'CANCELLED',
        'RECEIVED_PARTIAL',
        'RECEIVED_COMPLETE'
      ],
      default: 'DRAFT'
    },
    totalValue: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
    items: { type: [purchaseOrderItemSchema], default: [] }
  },
  {
    timestamps: true
  }
);

purchaseOrderSchema.index({ company: 1, poNumber: 1 }, { unique: true });

export const PurchaseOrder = model<PurchaseOrderDocument>('PurchaseOrder', purchaseOrderSchema);

