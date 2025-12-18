import { Schema, model, type Document, type Types } from 'mongoose';

export interface SalesInvoiceItem {
  item: Types.ObjectId;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  vat?: number; // VAT percentage (0-100)
  vatAmount?: number; // Calculated VAT amount in currency
  totalPrice: number;
}

export interface SalesInvoiceDocument extends Document<Types.ObjectId> {
  company?: Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  customer: Types.ObjectId;
  store: Types.ObjectId;
  subTotal: number;
  discountTotal: number;
  vatTotal?: number; // Total VAT amount for all items
  netAmount: number;
  taxAmount: number;
  notes?: string;
  createdBy?: Types.ObjectId;
  items: SalesInvoiceItem[];
  createdAt: Date;
  updatedAt: Date;
}

const salesInvoiceItemSchema = new Schema<SalesInvoiceItem>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    vat: { type: Number, default: 0, min: 0, max: 100 }, // VAT percentage
    vatAmount: { type: Number, default: 0, min: 0 }, // VAT amount in currency
    totalPrice: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const salesInvoiceSchema = new Schema<SalesInvoiceDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: false, index: true },
    invoiceNumber: { type: String, required: true, trim: true, unique: true },
    invoiceDate: { type: Date, default: Date.now },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    subTotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    vatTotal: { type: Number, default: 0, min: 0 }, // Total VAT amount
    netAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    items: { type: [salesInvoiceItemSchema], default: [] }
  },
  {
    timestamps: true
  }
);

// Unique index on invoiceNumber only (removed company from index)
salesInvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

export const SalesInvoice = model<SalesInvoiceDocument>('SalesInvoice', salesInvoiceSchema);

