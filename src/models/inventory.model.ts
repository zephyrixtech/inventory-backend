import { Schema, model, type Document, type Types } from 'mongoose';

export interface InventoryDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  item: Types.ObjectId;
  store: Types.ObjectId;
  quantity: number;
  unitPrice?: number;
  sellingPrice?: number;
  stockDate?: Date;
  expiryDate?: Date;
  purchaseOrder?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const inventorySchema = new Schema<InventoryDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, min: 0 },
    sellingPrice: { type: Number, min: 0 },
    stockDate: { type: Date },
    expiryDate: { type: Date },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    notes: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

inventorySchema.index({ company: 1, item: 1, store: 1 }, { unique: true });

export const Inventory = model<InventoryDocument>('Inventory', inventorySchema);

