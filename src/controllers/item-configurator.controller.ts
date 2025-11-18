import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { ItemConfigurator } from '../models/item-configurator.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listItemConfigurations = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { search, controlType } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = { company: companyId, isActive: true };

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') }
    ];
  }

  if (controlType && controlType !== 'all' && typeof controlType === 'string') {
    filters.control_type = controlType;
  }

  const query = ItemConfigurator.find(filters);

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ sequence: 1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [items, total] = await Promise.all([query.exec(), ItemConfigurator.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, items, buildPaginationMeta(page, limit, total));
});

export const getItemConfiguration = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const itemConfig = await ItemConfigurator.findOne({ 
    _id: req.params.id, 
    company: companyId,
    isActive: true 
  });

  if (!itemConfig) {
    throw ApiError.notFound('Item configuration not found');
  }

  return respond(res, StatusCodes.OK, itemConfig);
});

export const createItemConfiguration = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const { 
    name, 
    description, 
    control_type, 
    collection_id, 
    data_type, 
    sequence, 
    max_length, 
    item_unit_id, 
    is_mandatory 
  } = req.body;

  // Check if sequence already exists
  const existing = await ItemConfigurator.findOne({ company: companyId, sequence });
  if (existing) {
    throw ApiError.conflict(`Item configuration with sequence ${sequence} already exists`);
  }

  const itemConfig = await ItemConfigurator.create({
    company: companyId,
    name,
    description,
    control_type,
    ...(control_type === 'Dropdown' && collection_id && { 
      collection_id: Types.ObjectId.isValid(collection_id) ? new Types.ObjectId(collection_id) : collection_id 
    }),
    ...(control_type === 'Textbox' && data_type && { data_type }),
    sequence,
    max_length: control_type === 'Textbox' && data_type === 'text' ? max_length : 0,
    ...(data_type === 'unit' && item_unit_id && { 
      item_unit_id: Types.ObjectId.isValid(item_unit_id) ? new Types.ObjectId(item_unit_id) : item_unit_id 
    }),
    is_mandatory: is_mandatory || false,
    createdBy: req.user ? new Types.ObjectId(req.user.id) : undefined
  });

  return respond(res, StatusCodes.CREATED, itemConfig, {
    message: 'Item configuration created successfully'
  });
});

export const createMultipleItemConfigurations = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const configurations = req.body;

  // Validate that all sequences are unique
  const sequences = configurations.map((config: any) => config.sequence);
  const uniqueSequences = new Set(sequences);
  if (uniqueSequences.size !== sequences.length) {
    throw ApiError.badRequest('Duplicate sequences found in configurations');
  }

  // Check if any sequence already exists
  const existingSequences = await ItemConfigurator.find({ 
    company: companyId, 
    sequence: { $in: sequences } 
  });

  if (existingSequences.length > 0) {
    const existingSequenceNumbers = existingSequences.map(config => config.sequence).join(', ');
    throw ApiError.conflict(`Item configurations with sequences ${existingSequenceNumbers} already exist`);
  }

  // Process configurations
  const processedConfigs = configurations.map((config: any) => {
    // Validate required fields
    if (!config.name || !config.control_type || !config.sequence) {
      throw ApiError.badRequest('Name, control_type, and sequence are required for all configurations');
    }
    
    // Validate control_type
    if (!['Textbox', 'Dropdown', 'Textarea'].includes(config.control_type)) {
      throw ApiError.badRequest(`Invalid control_type: ${config.control_type}`);
    }
    
    // Validate sequence
    if (typeof config.sequence !== 'number' || config.sequence < 1) {
      throw ApiError.badRequest(`Invalid sequence: ${config.sequence}`);
    }
    
    const processedConfig: any = {
      company: companyId,
      name: config.name,
      description: config.description,
      control_type: config.control_type,
      sequence: config.sequence,
      max_length: config.control_type === 'Textbox' && config.data_type === 'text' ? config.max_length : 0,
      is_mandatory: config.is_mandatory || false,
      createdBy: req.user ? new Types.ObjectId(req.user.id) : undefined
    };
    
    // Add conditional fields
    if (config.control_type === 'Dropdown' && config.collection_id) {
      processedConfig.collection_id = Types.ObjectId.isValid(config.collection_id) ? new Types.ObjectId(config.collection_id) : config.collection_id;
    }
    
    if (config.control_type === 'Textbox' && config.data_type) {
      processedConfig.data_type = config.data_type;
    }
    
    if (config.data_type === 'unit' && config.item_unit_id) {
      processedConfig.item_unit_id = Types.ObjectId.isValid(config.item_unit_id) ? new Types.ObjectId(config.item_unit_id) : config.item_unit_id;
    }
    
    return processedConfig;
  });

  const itemConfigs = await ItemConfigurator.insertMany(processedConfigs);

  return respond(res, StatusCodes.CREATED, itemConfigs, {
    message: `${itemConfigs.length} item configurations created successfully`
  });
});

export const updateItemConfiguration = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const itemConfig = await ItemConfigurator.findOne({ 
    _id: req.params.id, 
    company: companyId,
    isActive: true 
  });

  if (!itemConfig) {
    throw ApiError.notFound('Item configuration not found');
  }

  const { 
    name, 
    description, 
    control_type, 
    collection_id, 
    data_type, 
    sequence, 
    max_length, 
    item_unit_id, 
    is_mandatory,
    isActive
  } = req.body;

  // If sequence is being updated, check if it already exists for another config
  if (sequence && sequence !== itemConfig.sequence) {
    const existing = await ItemConfigurator.findOne({ 
      company: companyId, 
      sequence,
      _id: { $ne: itemConfig._id }
    });
    if (existing) {
      throw ApiError.conflict(`Item configuration with sequence ${sequence} already exists`);
    }
  }

  itemConfig.name = name || itemConfig.name;
  itemConfig.description = description;
  itemConfig.control_type = control_type || itemConfig.control_type;
  
  // Handle conditional field updates
  if (control_type === 'Dropdown') {
    if (collection_id) {
      itemConfig.collection_id = Types.ObjectId.isValid(collection_id) ? new Types.ObjectId(collection_id) : collection_id;
    } else {
      itemConfig.collection_id = undefined;
    }
  } else {
    itemConfig.collection_id = undefined;
  }
  
  if (control_type === 'Textbox') {
    itemConfig.data_type = data_type || undefined;
  } else {
    itemConfig.data_type = undefined;
  }
  
  itemConfig.sequence = sequence || itemConfig.sequence;
  itemConfig.max_length = control_type === 'Textbox' && data_type === 'text' ? max_length : 0;
  
  if (data_type === 'unit') {
    if (item_unit_id) {
      itemConfig.item_unit_id = Types.ObjectId.isValid(item_unit_id) ? new Types.ObjectId(item_unit_id) : item_unit_id;
    } else {
      itemConfig.item_unit_id = undefined;
    }
  } else {
    itemConfig.item_unit_id = undefined;
  }
  
  itemConfig.is_mandatory = is_mandatory !== undefined ? is_mandatory : itemConfig.is_mandatory;
  if (isActive !== undefined) itemConfig.isActive = isActive;

  await itemConfig.save();

  return respond(res, StatusCodes.OK, itemConfig, {
    message: 'Item configuration updated successfully'
  });
});

export const deleteItemConfiguration = asyncHandler(async (req: Request, res: Response) => {
  const companyId = req.companyId;
  if (!companyId) {
    throw ApiError.badRequest('Company context missing');
  }

  const itemConfig = await ItemConfigurator.findOne({ 
    _id: req.params.id, 
    company: companyId 
  });

  if (!itemConfig) {
    throw ApiError.notFound('Item configuration not found');
  }

  itemConfig.isActive = false;
  await itemConfig.save();

  return respond(res, StatusCodes.OK, { success: true }, { 
    message: 'Item configuration deactivated successfully' 
  });
});