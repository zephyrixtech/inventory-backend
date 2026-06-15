import mongoose from 'mongoose';

const uri = 'mongodb://localhost:27017/inventory_db';

async function dropIndex() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    if (db) {
      const collection = db.collection('packinglists');
      const indexes = await collection.indexes();
      console.log('Indexes:', indexes);
      
      // Let's drop it if it has a different name
      try {
         await collection.dropIndex('company_1_boxNumber_1');
         console.log('dropped company_1_boxNumber_1');
      } catch(e) { console.log('not company_1_boxNumber_1'); }
    }
  } catch (error: any) {
    console.error('Error dropping index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

dropIndex();
