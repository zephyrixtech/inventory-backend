import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

type StoreStockDoc = {
  _id: mongoose.Types.ObjectId;
  store?: mongoose.Types.ObjectId | null;
  product?: mongoose.Types.ObjectId | null;
  quantity?: number;
  margin?: number;
  currency?: 'INR' | 'AED';
  unitPrice?: number;
  unitPriceAED?: number;
  dpPrice?: number;
  exchangeRate?: number;
  finalPrice?: number;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  updatedAt?: Date;
  createdAt?: Date;
};

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing in environment');
  }

  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  const collection = db.collection<StoreStockDoc>('storestocks');

  console.log('Checking indexes on storestocks...');
  const indexes = await collection.indexes();

  const badProductIndex = indexes.find((idx) => idx.name === 'product_1' && idx.unique);
  if (badProductIndex) {
    console.log('Dropping bad unique index product_1...');
    await collection.dropIndex('product_1');
  } else {
    console.log('Bad unique index product_1 not present.');
  }

  const oldCompanyStoreIndex = indexes.find((idx) => idx.name === 'company_1_store_1');
  if (oldCompanyStoreIndex) {
    console.log('Dropping stale index company_1_store_1...');
    await collection.dropIndex('company_1_store_1');
  }

  console.log('Checking duplicate rows for (store, product)...');
  const duplicates = await collection
    .aggregate<{
      _id: { store: mongoose.Types.ObjectId; product: mongoose.Types.ObjectId };
      docs: mongoose.Types.ObjectId[];
      totalQty: number;
      count: number;
    }>([
      {
        $match: {
          store: { $exists: true, $ne: null },
          product: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: { store: '$store', product: '$product' },
          docs: { $push: '$_id' },
          totalQty: { $sum: { $ifNull: ['$quantity', 0] } },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ])
    .toArray();

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate key groups. Merging...`);
    for (const group of duplicates) {
      const docs = await collection
        .find({ _id: { $in: group.docs } })
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .toArray();

      const keep = docs[0];
      const dropIds = docs.slice(1).map((d) => d._id);

      await collection.updateOne(
        { _id: keep._id },
        {
          $set: {
            quantity: group.totalQty
          }
        }
      );

      if (dropIds.length > 0) {
        await collection.deleteMany({ _id: { $in: dropIds } });
      }
    }
  } else {
    console.log('No duplicate (store, product) rows found.');
  }

  console.log('Creating unique compound index: { store: 1, product: 1 } ...');
  await collection.createIndex(
    { store: 1, product: 1 },
    {
      unique: true,
      name: 'store_1_product_1'
    }
  );

  console.log('Store stock index repair completed.');
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Store stock index repair failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
