
import mongoose from 'mongoose';
import { Store } from './src/models/store.model';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || '');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const checkStores = async () => {
    await connectDB();

    console.log('Checking stores...');
    const stores = await Store.find({});
    console.log(`Found ${stores.length} stores.`);

    stores.forEach(store => {
        console.log(`Store: ${store.name}, Purchaser: ${store.purchaser}, IsActive: ${store.isActive}`);
    });

    const targetStores = await Store.find({
        purchaser: 'ROLE_PURCHASER',
        isActive: true
    });
    console.log(`Found ${targetStores.length} stores with purchaser='ROLE_PURCHASER'`);

    process.exit();
};

checkStores();
