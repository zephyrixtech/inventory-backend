
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || '');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const fixIndex = async () => {
    const conn = await connectDB();
    const db = conn.connection.db;

    if (!db) {
        console.error('No DB connection');
        process.exit(1);
    }

    try {
        console.log('Listing indexes on storestocks...');
        const indexes = await db.collection('storestocks').indexes();
        console.log(JSON.stringify(indexes, null, 2));

        const badIndex = indexes.find(idx => idx.name === 'company_1_store_1');
        if (badIndex) {
            console.log('Found incorrect index: company_1_store_1. Dropping it...');
            await db.collection('storestocks').dropIndex('company_1_store_1');
            console.log('Successfully dropped index');
        } else {
            console.log('Index company_1_store_1 not found.');
        }

    } catch (error) {
        console.error('Error fixing index:', error);
    } finally {
        process.exit();
    }
};

fixIndex();
