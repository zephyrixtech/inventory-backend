import { Schema, model, type Document, type Types } from 'mongoose';

export interface SalesInvoiceItem {
  item: Types.ObjectId;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  totalPrice: number;
}

export interface SalesInvoiceDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  customer: Types.ObjectId;
  store: Types.ObjectId;
  subTotal: number;
  discountTotal: number;
  netAmount: number;
  taxAmount: number;
  notes?: string;
  createdBy: Types.ObjectId;
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
    totalPrice: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const salesInvoiceSchema = new Schema<SalesInvoiceDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, default: Date.now },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    subTotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [salesInvoiceItemSchema], default: [] }
  },
  {
    timestamps: true
  }
);

salesInvoiceSchema.index({ company: 1, invoiceNumber: 1 }, { unique: true });

export const SalesInvoice = model<SalesInvoiceDocument>('SalesInvoice', salesInvoiceSchema);

