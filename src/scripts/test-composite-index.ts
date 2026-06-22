import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { StoreStock } from '../models/store-stock.model';
import { Item } from '../models/item.model';
import { Store } from '../models/store.model';
import { PackingList } from '../models/packing-list.model';

dotenv.config();

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing');
  }

  await mongoose.connect(uri);
  console.log('Connected to Database.');

  // Find a product and store to run tests with
  const product = await Item.findOne();
  const store = await Store.findOne({ biller: 'ROLE_BILLER' });

  if (!product || !store) {
    console.log('Ensure you have at least one product and one biller store to test.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Testing with Product: ${product.name} (${product._id}) and Store: ${store.name} (${store._id})`);

  // Create two mock packing lists
  const pl1 = await PackingList.create({
    styleNumber: 'STYLE-TEST-001',
    createdBy: product.createdBy || new mongoose.Types.ObjectId(),
    items: [{ product: product._id, quantity: 10 }]
  });

  const pl2 = await PackingList.create({
    styleNumber: 'STYLE-TEST-002',
    createdBy: product.createdBy || new mongoose.Types.ObjectId(),
    items: [{ product: product._id, quantity: 5 }]
  });

  console.log(`Created packing list 1: ${pl1._id} (Style: STYLE-TEST-001)`);
  console.log(`Created packing list 2: ${pl2._id} (Style: STYLE-TEST-002)`);

  // Try creating StoreStock for pl1
  const stock1 = await StoreStock.create({
    product: product._id,
    store: store._id,
    quantity: 10,
    packingList: pl1._id,
    styleNumber: pl1.styleNumber,
    currency: 'AED',
    unitPrice: 100
  });
  console.log('✓ Successfully created store stock 1.');

  // Try creating StoreStock for pl2 (Same store, same product, different packing list)
  try {
    const stock2 = await StoreStock.create({
      product: product._id,
      store: store._id,
      quantity: 5,
      packingList: pl2._id,
      styleNumber: pl2.styleNumber,
      currency: 'AED',
      unitPrice: 120
    });
    console.log('✓ Successfully created store stock 2 (Separate entry for same item!).');
  } catch (err: any) {
    console.error('✗ Failed to create separate store stock entry:', err.message);
  }

  // Cleanup test documents
  await StoreStock.deleteOne({ packingList: pl1._id });
  await StoreStock.deleteOne({ packingList: pl2._id });
  await PackingList.deleteOne({ _id: pl1._id });
  await PackingList.deleteOne({ _id: pl2._id });
  console.log('Cleaned up test documents.');

  await mongoose.disconnect();
};

run().catch(console.error);
