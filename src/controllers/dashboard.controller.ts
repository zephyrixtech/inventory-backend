import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { startOfDay, subDays, isSameDay } from 'date-fns';

import { Item } from '../models/item.model';
import { Inventory } from '../models/inventory.model';
import { PurchaseOrder } from '../models/purchase-order.model';
import { SalesInvoice } from '../models/sales-invoice.model';
import { StoreStock } from '../models/store-stock.model';
import { Store } from '../models/store.model';
import { User } from '../models/user.model';
import { PurchaseEntry } from '../models/purchase-entry.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const getDashboardMetrics = asyncHandler(async (req: Request, res: Response) => {
  // Get user info from request (set by auth middleware)
  const userId = req.user?.id;
  const userRole = req.user?.role || 'biller';

  if (!userId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  // Get user details to find their email for store assignments
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Find stores assigned to this user based on their role
  let assignedStores: any[] = [];
  if (userRole === 'purchaser') {
    // Try multiple approaches to find purchaser stores
    assignedStores = await Store.find({ purchaser: `ROLE_PURCHASER` });
    console.log(`Purchaser stores found by role: ${assignedStores.length}`, assignedStores.map(s => ({ name: s.name, id: s._id })));
    
    // If no stores found by role, try finding by name pattern
    if (assignedStores.length === 0) {
      assignedStores = await Store.find({ name: /purchaser/i });
      console.log(`Purchaser stores found by name pattern: ${assignedStores.length}`, assignedStores.map(s => ({ name: s.name, id: s._id })));
    }
    
    // If still no stores found, get all stores as fallback
    if (assignedStores.length === 0) {
      assignedStores = await Store.find({});
      console.log(`Using all stores as fallback: ${assignedStores.length}`, assignedStores.map(s => ({ name: s.name, id: s._id })));
    }
  } else if (userRole === 'biller') {
    assignedStores = await Store.find({ biller: `ROLE_BILLER` });
    console.log(`Biller stores found: ${assignedStores.length}`, assignedStores.map(s => ({ name: s.name, id: s._id })));
    
    // If no stores found by role, try finding by name pattern
    if (assignedStores.length === 0) {
      assignedStores = await Store.find({ name: /biller/i });
      console.log(`Biller stores found by name pattern: ${assignedStores.length}`, assignedStores.map(s => ({ name: s.name, id: s._id })));
    }
  }

  const assignedStoreIds = assignedStores.map(store => store._id);
  console.log(`Assigned store IDs for ${userRole}:`, assignedStoreIds);

  const [totalItems, totalValueResult, inventoryRecords, purchaseOrders, salesInvoices, purchaseEntries] = await Promise.all([
    Item.countDocuments({}),
    Item.aggregate([{ $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
    Inventory.find({}).populate('item'),
    PurchaseOrder.find({ isActive: true }),
    SalesInvoice.find({}),
    PurchaseEntry.find({ isActive: true })
  ]);

  const totalValue = totalValueResult[0]?.total || 0;

  const totalPurchaseOrders = purchaseOrders.length;
  const totalPurchaseOrderValue = purchaseOrders.reduce((sum, po) => sum + (po.totalValue ?? 0), 0);

  const totalSalesInvoices = salesInvoices.length;
  const totalSalesInvoiceValue = salesInvoices.reduce((sum, invoice) => sum + (invoice.netAmount ?? 0), 0);

  // Get role-based item stock data instead of category data
  let itemStockData: Array<{ name: string; stock: number; fill?: string }> = [];
  
  if (userRole === 'purchaser') {
    // For purchaser: get store stock data from their assigned stores (same as Store Stock page)
    let storeStockQuery = {};
    if (assignedStoreIds.length > 0) {
      storeStockQuery = { store: { $in: assignedStoreIds } };
    } else {
      // If no assigned stores, show all store stock (fallback)
      console.log('No assigned stores found for purchaser, showing all store stock');
    }
    
    console.log('Purchaser store stock query:', storeStockQuery);
    const purchaserStoreStockRecords = await StoreStock.find(storeStockQuery).populate('product');
    console.log(`Purchaser store stock records found: ${purchaserStoreStockRecords.length}`);
    
    const storeStockAggregates: Record<string, { name: string; total: number }> = {};
    
    purchaserStoreStockRecords.forEach((record) => {
      const product = record.product as any;
      if (!product) return;

      const key = product._id.toString();
      if (!storeStockAggregates[key]) {
        storeStockAggregates[key] = {
          name: product.name,
          total: 0
        };
      }
      storeStockAggregates[key].total += record.quantity;
    });

    console.log(`Purchaser store stock aggregates: ${Object.keys(storeStockAggregates).length} items`);

    itemStockData = Object.values(storeStockAggregates)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10) // Top 10 items
      .map((item, index) => ({
        name: item.name,
        stock: item.total,
        fill: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6'][index % 10]
      }));
  } else if (userRole === 'biller') {
    // For biller: get store stock data from their assigned stores
    let storeStockQuery = {};
    if (assignedStoreIds.length > 0) {
      storeStockQuery = { store: { $in: assignedStoreIds } };
    } else {
      // If no assigned stores, show all store stock (fallback)
      console.log('No assigned stores found for biller, showing all store stock');
    }
    
    console.log('Biller store stock query:', storeStockQuery);
    const billerStoreStockRecords = await StoreStock.find(storeStockQuery).populate('product');
    console.log(`Biller store stock records found: ${billerStoreStockRecords.length}`);
    
    const storeStockAggregates: Record<string, { name: string; total: number }> = {};
    
    billerStoreStockRecords.forEach((record) => {
      const product = record.product as any;
      if (!product) return;

      const key = product._id.toString();
      if (!storeStockAggregates[key]) {
        storeStockAggregates[key] = {
          name: product.name,
          total: 0
        };
      }
      storeStockAggregates[key].total += record.quantity;
    });

    console.log(`Biller store stock aggregates: ${Object.keys(storeStockAggregates).length} items`);

    itemStockData = Object.values(storeStockAggregates)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10) // Top 10 items
      .map((item, index) => ({
        name: item.name,
        stock: item.total,
        fill: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6'][index % 10]
      }));
  } else {
    // For admin/superadmin: combine both inventory and store stock data from all stores
    const inventoryAggregates: Record<string, { name: string; total: number }> = {};
    inventoryRecords.forEach((record) => {
      const item = record.item as any;
      if (!item) return;

      const key = item._id.toString();
      if (!inventoryAggregates[key]) {
        inventoryAggregates[key] = {
          name: item.name,
          total: 0
        };
      }
      inventoryAggregates[key].total += record.quantity;
    });

    const storeStockRecords = await StoreStock.find({}).populate('product');
    storeStockRecords.forEach((record) => {
      const product = record.product as any;
      if (!product) return;

      const key = product._id.toString();
      if (!inventoryAggregates[key]) {
        inventoryAggregates[key] = {
          name: product.name,
          total: 0
        };
      }
      inventoryAggregates[key].total += record.quantity;
    });

    itemStockData = Object.values(inventoryAggregates)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10) // Top 10 items
      .map((item, index) => ({
        name: item.name,
        stock: item.total,
        fill: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6'][index % 10]
      }));
  }

  const salesData: Array<{ day: string; sales: number }> = [];
  const today = startOfDay(new Date());
  for (let i = 29; i >= 0; i -= 1) {
    const dayDate = subDays(today, i);
    const daySales = salesInvoices
      .filter((invoice) => isSameDay(new Date(invoice.invoiceDate), dayDate))
      .reduce((sum, invoice) => sum + invoice.netAmount, 0);

    salesData.push({ day: dayDate.toISOString().split('T')[0], sales: Math.round(daySales) });
  }

  // Generate purchase entry turnover data for purchaser, admin, and superadmin
  let purchaseEntryData: Array<{ day: string; purchases: number }> = [];
  if (userRole === 'purchaser' || userRole === 'admin' || userRole === 'superadmin') {
    for (let i = 29; i >= 0; i -= 1) {
      const dayDate = subDays(today, i);
      const dayPurchases = purchaseEntries
        .filter((entry) => isSameDay(new Date(entry.date), dayDate))
        .reduce((sum, entry) => sum + entry.finalAmount, 0);

      purchaseEntryData.push({ day: dayDate.toISOString().split('T')[0], purchases: Math.round(dayPurchases) });
    }
    console.log(`Purchase entry data generated for ${userRole}: ${purchaseEntryData.length} days`);
  }

  // Role-based fast/slow moving items
  let fastMovingItems: Array<{ name: string; avgQuantity: number }> = [];
  let slowMovingItems: Array<{ name: string; avgQuantity: number }> = [];

  if (userRole === 'purchaser') {
    // For purchaser: use store stock data from their assigned stores (same as Store Stock page)
    let storeStockQuery = {};
    if (assignedStoreIds.length > 0) {
      storeStockQuery = { store: { $in: assignedStoreIds } };
    } else {
      console.log('No assigned stores for purchaser fast/slow items, using all store stock');
    }
    
    const purchaserStoreStockRecords = await StoreStock.find(storeStockQuery).populate('product');
    const storeStockAggregates: Record<string, { name: string; total: number }> = {};
    
    purchaserStoreStockRecords.forEach((record) => {
      const product = record.product as any;
      if (!product) return;

      const key = product._id.toString();
      if (!storeStockAggregates[key]) {
        storeStockAggregates[key] = {
          name: product.name,
          total: 0
        };
      }
      storeStockAggregates[key].total += record.quantity;
    });

    const sortedItems = Object.values(storeStockAggregates).sort((a, b) => b.total - a.total);
    fastMovingItems = sortedItems.slice(0, 5).map((item) => ({ name: item.name, avgQuantity: item.total }));
    slowMovingItems = sortedItems.slice(-5).map((item) => ({ name: item.name, avgQuantity: item.total }));
  } else if (userRole === 'biller') {
    // For biller: use store stock data from their assigned stores
    let storeStockQuery = {};
    if (assignedStoreIds.length > 0) {
      storeStockQuery = { store: { $in: assignedStoreIds } };
    } else {
      console.log('No assigned stores for biller fast/slow items, using all store stock');
    }
    
    const billerStoreStockRecords = await StoreStock.find(storeStockQuery).populate('product');
    const storeStockAggregates: Record<string, { name: string; total: number }> = {};
    
    billerStoreStockRecords.forEach((record) => {
      const product = record.product as any;
      if (!product) return;

      const key = product._id.toString();
      if (!storeStockAggregates[key]) {
        storeStockAggregates[key] = {
          name: product.name,
          total: 0
        };
      }
      storeStockAggregates[key].total += record.quantity;
    });

    const sortedItems = Object.values(storeStockAggregates).sort((a, b) => b.total - a.total);
    fastMovingItems = sortedItems.slice(0, 5).map((item) => ({ name: item.name, avgQuantity: item.total }));
    slowMovingItems = sortedItems.slice(-5).map((item) => ({ name: item.name, avgQuantity: item.total }));
  } else {
    // For admin/superadmin: use combined inventory and store stock data (same as itemStockData logic)
    const inventoryAggregates: Record<string, { name: string; total: number }> = {};
    
    // Add inventory data
    inventoryRecords.forEach((record) => {
      const item = record.item as any;
      if (!item) return;

      const key = item._id.toString();
      if (!inventoryAggregates[key]) {
        inventoryAggregates[key] = {
          name: item.name,
          total: 0
        };
      }
      inventoryAggregates[key].total += record.quantity;
    });

    // Add store stock data
    const storeStockRecords = await StoreStock.find({}).populate('product');
    storeStockRecords.forEach((record) => {
      const product = record.product as any;
      if (!product) return;

      const key = product._id.toString();
      if (!inventoryAggregates[key]) {
        inventoryAggregates[key] = {
          name: product.name,
          total: 0
        };
      }
      inventoryAggregates[key].total += record.quantity;
    });

    console.log(`Admin combined aggregates for fast/slow items: ${Object.keys(inventoryAggregates).length} items`);

    const sortedItems = Object.values(inventoryAggregates).sort((a, b) => b.total - a.total);
    fastMovingItems = sortedItems.slice(0, 5).map((item) => ({ name: item.name, avgQuantity: item.total }));
    slowMovingItems = sortedItems.slice(-5).map((item) => ({ name: item.name, avgQuantity: item.total }));
  }

  console.log(`Final itemStockData for ${userRole}: ${itemStockData.length} items`);
  console.log('Item stock data:', itemStockData.map(item => ({ name: item.name, stock: item.stock })));
  console.log(`Fast moving items for ${userRole}: ${fastMovingItems.length} items`);
  console.log('Fast moving items:', fastMovingItems.map(item => ({ name: item.name, quantity: item.avgQuantity })));
  console.log(`Slow moving items for ${userRole}: ${slowMovingItems.length} items`);
  console.log('Slow moving items:', slowMovingItems.map(item => ({ name: item.name, quantity: item.avgQuantity })));

  return respond(res, StatusCodes.OK, {
    metrics: {
      totalItems,
      totalValue,
      totalPurchaseOrders,
      totalPurchaseOrderValue,
      totalSalesInvoices, // Added this new metric
      totalSalesInvoiceValue // Added this new metric
    },
    itemStockData, // Changed from categoryData to itemStockData
    salesData,
    purchaseEntryData, // Added purchase entry turnover data
    fastMovingItems,
    slowMovingItems
  });
});