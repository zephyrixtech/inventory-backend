import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { StoreStock } from '../models/store-stock.model';
import { Item } from '../models/item.model';
import { PackingList } from '../models/packing-list.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';
import { logAudit } from '../utils/audit-logger';

export const listStoreStock = asyncHandler(async (req: Request, res: Response) => {

  const { search, storeId } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  // Get user role from request
  const userRole = (req.user as any)?.role || (req.user as any)?.role_name;

  // Build filters object
  const filters: Record<string, unknown> = {};

  if (storeId && typeof storeId === 'string') {
    filters.store = new Types.ObjectId(storeId);
  }

  if (search && typeof search === 'string') {
    let productIds: Types.ObjectId[] = [];
    if (req.query.styleOnly === 'true') {
      const matchingProducts = await Item.find({
        styleNumbers: new RegExp(search, 'i')
      }).select('_id');

      productIds = matchingProducts.map((p) => p._id);

      const matchingPackingLists = await PackingList.find({
        styleNumber: new RegExp(search, 'i')
      }).select('items.product');

      for (const pl of matchingPackingLists) {
        for (const item of pl.items) {
          if (item.product && !productIds.some(id => id.toString() === item.product.toString())) {
            productIds.push(item.product as Types.ObjectId);
          }
        }
      }

      filters.$or = [
        { product: { $in: productIds } },
        { styleNumber: new RegExp(search, 'i') }
      ];
    } else {
      const matchingProducts = await Item.find({
        $or: [
          { name: new RegExp(search, 'i') },
          { code: new RegExp(search, 'i') },
          { styleNumbers: new RegExp(search, 'i') }
        ]
      }).select('_id');

      productIds = matchingProducts.map((p) => p._id);

      const matchingPackingLists = await PackingList.find({
        styleNumber: new RegExp(search, 'i')
      }).select('items.product');

      for (const pl of matchingPackingLists) {
        for (const item of pl.items) {
          if (item.product && !productIds.some(id => id.toString() === item.product.toString())) {
            productIds.push(item.product as Types.ObjectId);
          }
        }
      }

      filters.product = { $in: productIds };
    }
  }

  // Build the aggregation pipeline for role-based filtering
  const pipeline: any[] = [
    { $match: filters },
    { $match: { quantity: { $ne: 0 } } },
    {
      $lookup: {
        from: 'stores',
        localField: 'store',
        foreignField: '_id',
        as: 'storeData'
      }
    },
    {
      $unwind: {
        path: '$storeData',
        preserveNullAndEmptyArrays: true
      }
    }
  ];

  // Add role-based filtering
  if (userRole && userRole !== 'admin' && userRole !== 'superadmin') {
    const roleField = userRole === 'biller' ? 'storeData.biller' : 
                     userRole === 'purchaser' ? 'storeData.purchaser' : null;
    
    if (roleField) {
      pipeline.push({
        $match: {
          [roleField]: `ROLE_${userRole.toUpperCase()}`
        }
      });
    }
  }

  // Add lookup for product and lastUpdatedBy
  pipeline.push(
    {
      $lookup: {
        from: 'items',
        localField: 'product',
        foreignField: '_id',
        as: 'productData'
      }
    },
    {
      $unwind: {
        path: '$productData',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'suppliers',
        localField: 'productData.vendor',
        foreignField: '_id',
        as: 'vendorData'
      }
    },
    {
      $unwind: {
        path: '$vendorData',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'lastUpdatedBy',
        foreignField: '_id',
        as: 'lastUpdatedByData'
      }
    },
    {
      $unwind: {
        path: '$lastUpdatedByData',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        allPackingLists: {
          $setUnion: [
            { $cond: [ { $ifNull: ["$packingLists", null] }, "$packingLists", [] ] },
            { $cond: [ { $ifNull: ["$packingList", null] }, ["$packingList"], [] ] }
          ]
        }
      }
    },
    {
      $lookup: {
        from: 'packinglists',
        localField: 'allPackingLists',
        foreignField: '_id',
        as: 'packingListsData'
      }
    }
  );

  // Add projection to match the expected format
  pipeline.push({
    $project: {
      _id: 1,
      quantity: 1,
      margin: 1,
      currency: 1,
      unitPrice: 1,
      unitPriceAED: 1,
      dpPrice: 1,
      exchangeRate: 1,
      finalPrice: 1,
      packingList: 1,
      shipmentDate: { $max: "$packingListsData.shipmentDate" },
      cargoNumber: {
        $reduce: {
          input: {
            $filter: {
              input: "$packingListsData.cargoNumber",
              as: "cargo",
              cond: { $gt: [ { $strLenCP: { $ifNull: ["$$cargo", ""] } }, 0 ] }
            }
          },
          initialValue: "",
          in: {
            $cond: [
              { $eq: ["$$value", ""] },
              "$$this",
              { $concat: ["$$value", ", ", "$$this"] }
            ]
          }
        }
      },
      styleNumber: {
        $cond: [
          { $gt: [ { $strLenCP: { $ifNull: ["$styleNumber", ""] } }, 0 ] },
          "$styleNumber",
          {
            $reduce: {
              input: {
                $filter: {
                  input: {
                    $setUnion: [
                      { $cond: [ { $isArray: "$productData.styleNumbers" }, "$productData.styleNumbers", [] ] },
                      { $cond: [ { $isArray: "$packingListsData.styleNumber" }, "$packingListsData.styleNumber", [] ] }
                    ]
                  },
                  as: "style",
                  cond: { $gt: [ { $strLenCP: { $ifNull: ["$$style", ""] } }, 0 ] }
                }
              },
              initialValue: "",
              in: {
                $cond: [
                  { $eq: ["$$value", ""] },
                  "$$this",
                  { $concat: ["$$value", ", ", "$$this"] }
                ]
              }
            }
          }
        ]
      },
      packingListDetails: {
        _id: { $arrayElemAt: ["$packingListsData._id", 0] },
        shipmentDate: { $max: "$packingListsData.shipmentDate" },
        cargoNumber: {
          $reduce: {
            input: {
              $filter: {
                input: "$packingListsData.cargoNumber",
                as: "cargo",
                cond: { $gt: [ { $strLenCP: { $ifNull: ["$$cargo", ""] } }, 0 ] }
              }
            },
            initialValue: "",
            in: {
              $cond: [
                { $eq: ["$$value", ""] },
                "$$this",
                { $concat: ["$$value", ", ", "$$this"] }
              ]
            }
          }
        },
        styleNumber: {
          $cond: [
            { $gt: [ { $strLenCP: { $ifNull: ["$styleNumber", ""] } }, 0 ] },
            "$styleNumber",
            {
              $reduce: {
                input: {
                  $filter: {
                    input: {
                      $setUnion: [
                        { $cond: [ { $isArray: "$productData.styleNumbers" }, "$productData.styleNumbers", [] ] },
                        { $cond: [ { $isArray: "$packingListsData.styleNumber" }, "$packingListsData.styleNumber", [] ] }
                      ]
                    },
                    as: "style",
                    cond: { $gt: [ { $strLenCP: { $ifNull: ["$$style", ""] } }, 0 ] }
                  }
                },
                initialValue: "",
                in: {
                  $cond: [
                    { $eq: ["$$value", ""] },
                    "$$this",
                    { $concat: ["$$value", ", ", "$$this"] }
                  ]
                }
              }
            }
          ]
        }
      },
      createdAt: 1,
      updatedAt: 1,
      __v: 1,
      product: {
        _id: '$productData._id',
        id: '$productData._id',
        name: '$productData.name',
        code: '$productData.code',
        unitPrice: '$productData.unitPrice',
        currency: '$productData.currency',
        quantity: '$productData.quantity',
        status: '$productData.status',
        vendor: {
          _id: '$vendorData._id',
          name: '$vendorData.name'
        }
      },
      store: {
        _id: '$storeData._id',
        name: '$storeData.name',
        code: '$storeData.code',
        type: '$storeData.type',
        biller: '$storeData.biller',
        purchaser: '$storeData.purchaser'
      },
      lastUpdatedBy: {
        _id: '$lastUpdatedByData._id',
        firstName: '$lastUpdatedByData.firstName',
        lastName: '$lastUpdatedByData.lastName'
      }
    }
  });

  // Match computed styleNumber if styleOnly is true
  if (search && typeof search === 'string' && req.query.styleOnly === 'true') {
    pipeline.push({
      $match: {
        styleNumber: new RegExp(search, 'i')
      }
    });
  }

  // Execute aggregation: one with sort/skip/limit, one with count
  const [stock, totalResult] = await Promise.all([
    StoreStock.aggregate([
      ...pipeline,
      ...(sortBy ? [{ $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } }] : [{ $sort: { updatedAt: -1 } }]),
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]),
    StoreStock.aggregate([
      ...pipeline,
      { $count: 'total' }
    ])
  ]);

  const total = totalResult.length > 0 ? totalResult[0].total : 0;

  return respond(res, StatusCodes.OK, stock, buildPaginationMeta(page, limit, total));
});

export const upsertStoreStock = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { productId, storeId, quantity, margin, currency, packingListId, dpPrice, finalPrice, exchangeRate, unitPrice } = req.body;

  // Validate required fields
  if (!productId) {
    throw ApiError.badRequest('Product ID is required');
  }

  if (typeof quantity !== 'number' || quantity < 0) {
    throw ApiError.badRequest('Quantity must be a non-negative number');
  }

  // Removed company filter since we're removing company context
  const product = await Item.findById(productId);

  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  if (product.status !== 'store_pending' && product.status !== 'store_approved') {
    product.status = 'store_pending';
  }

  product.storeApprovedBy = new Types.ObjectId(req.user.id);
  product.storeApprovedAt = new Date();
  product.status = 'store_approved';

  await product.save();

  const basePrice = product.unitPrice ?? 0;
  const marginPercentage = Number(margin ?? 0);

  // Validate margin percentage
  if (marginPercentage < 0) {
    throw ApiError.badRequest('Margin percentage cannot be negative');
  }

  // Validate base price
  if (basePrice < 0) {
    throw ApiError.badRequest('Product unit price cannot be negative');
  }

  const finalUnitPrice = basePrice + (basePrice * marginPercentage) / 100;

  // Validate currency
  const validCurrencies = ['INR', 'AED'];
  const selectedCurrency = currency ?? product.currency ?? 'INR';
  if (!validCurrencies.includes(selectedCurrency)) {
    throw ApiError.badRequest('Currency must be either INR or AED');
  }

  // Resolve style number if packing list is provided
  let styleNumber: string | undefined;
  if (packingListId) {
    const pl = await PackingList.findById(packingListId);
    if (pl) {
      styleNumber = pl.styleNumber;
    }
  }

  // Check if stock exists
  let stock = await StoreStock.findOne({
    product: product._id,
    store: storeId ? new Types.ObjectId(storeId) : null,
    packingList: packingListId ? new Types.ObjectId(packingListId) : null
  });

  if (stock) {
    const oldQty = stock.quantity;
    stock.quantity += quantity;
    stock.margin = marginPercentage;
    stock.currency = selectedCurrency;
    stock.unitPrice = unitPrice || finalUnitPrice;
    if (dpPrice !== undefined) stock.dpPrice = dpPrice;
    if (finalPrice !== undefined) stock.finalPrice = finalPrice;
    if (exchangeRate !== undefined) stock.exchangeRate = exchangeRate;
    if (styleNumber !== undefined) stock.styleNumber = styleNumber;
    if (packingListId) {
      const plObjectId = new Types.ObjectId(packingListId);
      if (!stock.packingLists) stock.packingLists = [];
      const existingPackingList = stock.packingList;
      if (existingPackingList && !stock.packingLists.some(id => id.toString() === existingPackingList.toString())) {
        stock.packingLists.push(existingPackingList);
      }
      stock.packingList = plObjectId;
      if (!stock.packingLists.some(id => id.toString() === plObjectId.toString())) {
        stock.packingLists.push(plObjectId);
      }
    }
    if (storeId) stock.store = new Types.ObjectId(storeId);
    stock.lastUpdatedBy = new Types.ObjectId(req.user.id);
    await stock.save();

    // Log activity
    await logAudit(
      req,
      'Store Stock',
      'Stock Adjustment',
      stock.styleNumber || product.code,
      `Added ${quantity} units to store stock of "${product.name}" (Code: ${product.code}). New quantity: ${stock.quantity}.`
    );
  } else {
    stock = await StoreStock.create({
      product: product._id,
      store: storeId ? new Types.ObjectId(storeId) : null,
      quantity,
      margin: marginPercentage,
      currency: selectedCurrency,
      unitPrice: unitPrice || finalUnitPrice, // Use provided unitPrice (AED) if available
      packingList: packingListId ? new Types.ObjectId(packingListId) : undefined,
      packingLists: packingListId ? [new Types.ObjectId(packingListId)] : [],
      dpPrice,
      exchangeRate,
      finalPrice,
      styleNumber,
      lastUpdatedBy: new Types.ObjectId(req.user.id)
    });

    // Log activity
    await logAudit(
      req,
      'Store Stock',
      'Stock Adjustment',
      stock.styleNumber || product.code,
      `Created store stock for "${product.name}" (Code: ${product.code}) with quantity ${quantity}.`
    );
  }

  // Re-fetch to populate
  stock = await StoreStock.findById(stock._id)
    .populate({
      path: 'product',
      select: 'name code currency unitPrice quantity status vendor',
      populate: {
        path: 'vendor',
        select: 'name'
      }
    })
    .populate('store', 'name code type');

  return respond(res, StatusCodes.OK, stock, { message: 'Store stock updated successfully' });
});

export const adjustStockQuantity = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context
  if (!req.user) {
    throw ApiError.badRequest('User context missing');
  }

  const { quantity } = req.body;

  // Removed company filter since we're removing company context
  const stock = await StoreStock.findById(req.params.id);

  if (!stock) {
    throw ApiError.notFound('Store stock record not found');
  }

  if (typeof quantity !== 'number') {
    throw ApiError.badRequest('Quantity is required');
  }

  const oldQty = stock.quantity;
  stock.quantity = quantity;
  stock.lastUpdatedBy = new Types.ObjectId(req.user.id);

  await stock.save();

  // Log activity
  await logAudit(
    req,
    'Store Stock',
    'Stock Adjustment',
    stock.styleNumber || stock.product.toString(),
    `Manually adjusted stock quantity of product from ${oldQty} to ${quantity}.`
  );

  return respond(res, StatusCodes.OK, stock, { message: 'Stock quantity adjusted successfully' });
});
