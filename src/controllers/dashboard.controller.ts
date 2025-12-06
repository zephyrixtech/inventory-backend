import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { startOfDay, subDays, isSameDay } from 'date-fns';

import { Types } from 'mongoose';

import { Item } from '../models/item.model';
import { Inventory } from '../models/inventory.model';
import { PurchaseOrder } from '../models/purchase-order.model';
import { SalesInvoice } from '../models/sales-invoice.model';
import { Category } from '../models/category.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const getDashboardMetrics = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const [totalItems, inventoryRecords, purchaseOrders, salesInvoices, categories] = await Promise.all([
    Item.countDocuments({}),
    Inventory.find({}).populate('item'),
    PurchaseOrder.find({ isActive: true }),
    SalesInvoice.find({}),
    Category.find({ isActive: true })
  ]);

  const totalValue = inventoryRecords.reduce((sum, record) => {
    const price = record.sellingPrice ?? record.unitPrice ?? 0;
    return sum + record.quantity * price;
  }, 0);

  const totalPurchaseOrders = purchaseOrders.length;
  const totalPurchaseOrderValue = purchaseOrders.reduce((sum, po) => sum + (po.totalValue ?? 0), 0);

  const categoryData = categories.map((category, index) => {
    const stock = inventoryRecords
      .filter((record) => {
        const itemDoc = record.item as { category?: Types.ObjectId } | null;
        return Boolean(itemDoc?.category && itemDoc.category === category._id);
      })
      .reduce((sum, record) => sum + record.quantity, 0);

    return {
      name: category.name,
      stock,
      fill: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'][index % 8]
    };
  });

  const salesData: Array<{ day: string; sales: number }> = [];
  const today = startOfDay(new Date());
  for (let i = 29; i >= 0; i -= 1) {
    const dayDate = subDays(today, i);
    const daySales = salesInvoices
      .filter((invoice) => isSameDay(new Date(invoice.invoiceDate), dayDate))
      .reduce((sum, invoice) => sum + invoice.netAmount, 0);

    salesData.push({ day: dayDate.toISOString().split('T')[0], sales: Math.round(daySales) });
  }

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

  const sortedItems = Object.values(inventoryAggregates).sort((a, b) => b.total - a.total);
  const fastMovingItems = sortedItems.slice(0, 5).map((item) => ({ name: item.name, avgQuantity: item.total }));
  const slowMovingItems = sortedItems.slice(-5).map((item) => ({ name: item.name, avgQuantity: item.total }));

  const inventoryAlerts = inventoryRecords
    .map((record) => {
      const item = record.item as any;
      if (!item) return null;

      const totalQty = record.quantity;
      if (item.reorderLevel && totalQty <= item.reorderLevel) {
        return {
          itemName: item.name,
          currentQty: totalQty,
          reorderLevel: item.reorderLevel,
          maxLevel: item.maxLevel ?? 0,
          alertType: 'low_stock',
          severity: totalQty === 0 ? 'high' : totalQty <= item.reorderLevel * 0.5 ? 'medium' : 'low'
        };
      }

      if (item.maxLevel && totalQty >= item.maxLevel) {
        return {
          itemName: item.name,
          currentQty: totalQty,
          reorderLevel: item.reorderLevel ?? 0,
          maxLevel: item.maxLevel,
          alertType: 'excess_stock',
          severity: totalQty >= item.maxLevel * 1.5 ? 'high' : totalQty >= item.maxLevel * 1.2 ? 'medium' : 'low'
        };
      }

      return null;
    })
    .filter(Boolean);

  return respond(res, StatusCodes.OK, {
    metrics: {
      totalItems,
      totalValue,
      totalPurchaseOrders,
      totalPurchaseOrderValue
    },
    categoryData,
    salesData,
    fastMovingItems,
    slowMovingItems,
    inventoryAlerts
  });
});

