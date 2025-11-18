import { Router } from 'express';

import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import supplierRoutes from './supplier.routes';
import categoryRoutes from './category.routes';
import itemRoutes from './item.routes';
import itemConfiguratorRoutes from './item-configurator.routes';
import storeRoutes from './store.routes';
import customerRoutes from './customer.routes';
import inventoryRoutes from './inventory.routes';
import purchaseOrderRoutes from './purchase-order.routes';
import salesInvoiceRoutes from './sales-invoice.routes';
import dashboardRoutes from './dashboard.routes';
import vendorRoutes from './vendor.routes';
import qualityCheckRoutes from './quality-check.routes';
import packingListRoutes from './packing-list.routes';
import storeStockRoutes from './store-stock.routes';
import dailyExpenseRoutes from './daily-expense.routes';
import currencyRoutes from './currency.routes';
import reportRoutes from './report.routes';
import companyAdministrationRoutes from './company-administration.routes';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/roles', roleRoutes);
apiRouter.use('/suppliers', supplierRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/items', itemRoutes);
apiRouter.use('/item-configurations', itemConfiguratorRoutes);
apiRouter.use('/stores', storeRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/purchase-orders', purchaseOrderRoutes);
apiRouter.use('/sales-invoices', salesInvoiceRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/vendors', vendorRoutes);
apiRouter.use('/quality-checks', qualityCheckRoutes);
apiRouter.use('/packing-lists', packingListRoutes);
apiRouter.use('/store-stock', storeStockRoutes);
apiRouter.use('/expenses', dailyExpenseRoutes);
apiRouter.use('/currency', currencyRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/company-administration', companyAdministrationRoutes);

export default apiRouter;