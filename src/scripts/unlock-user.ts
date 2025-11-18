import mongoose from 'mongoose';
import { config } from '../config/env';
import { User } from '../models/user.model';

async function unlockUser(email: string) {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    console.log('Connected to database');

    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`User with email ${email} not found`);
      process.exit(1);
    }

    // Unlock the user
    user.status = 'active';
    user.failedAttempts = 0;
    await user.save();

    console.log(`Successfully unlocked user ${email}`);
    console.log(`Status: ${user.status}`);
    console.log(`Failed attempts: ${user.failedAttempts}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error unlocking user:', error);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('Usage: npm run unlock-user <email>');
  process.exit(1);
}

unlockUser(email);