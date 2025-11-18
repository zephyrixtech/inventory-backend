import { Schema, model, type Document, type Types } from 'mongoose';

export interface ItemConfiguratorDocument extends Document<Types.ObjectId> {
  company: Types.ObjectId;
  name: string;
  description?: string;
  control_type: 'Textbox' | 'Dropdown' | 'Textarea';
  collection_id?: Types.ObjectId | string;
  data_type?: 'text' | 'number' | 'unit';
  sequence: number;
  max_length?: number;
  item_unit_id?: Types.ObjectId | string;
  is_mandatory: boolean;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemConfiguratorSchema = new Schema<ItemConfiguratorDocument>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    control_type: { 
      type: String, 
      required: true,
      enum: ['Textbox', 'Dropdown', 'Textarea']
    },
    collection_id: { type: Schema.Types.Mixed, ref: 'Collection' },
    data_type: { 
      type: String, 
      enum: ['text', 'number', 'unit']
    },
    sequence: { type: Number, required: true, min: 1 },
    max_length: { type: Number, min: 0 },
    item_unit_id: { type: Schema.Types.Mixed, ref: 'Unit' },
    is_mandatory: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true
  }
);

itemConfiguratorSchema.index({ company: 1, sequence: 1 }, { unique: true });
itemConfiguratorSchema.index({ company: 1, name: 1 });

export const ItemConfigurator = model<ItemConfiguratorDocument>('ItemConfigurator', itemConfiguratorSchema);