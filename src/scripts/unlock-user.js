const mongoose = require('mongoose');
require('dotenv').config();

// User model schema
const userSchema = new mongoose.Schema({
  email: String,
  status: String,
  failedAttempts: Number
});

const User = mongoose.model('User', userSchema);

async function unlockUser(email) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
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
  console.log('Usage: node unlock-user.js <email>');
  process.exit(1);
}

unlockUser(email);