import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { config } from './env';

mongoose.set('strictQuery', false);

let isConnected = false;

export const connectDatabase = async (): Promise<void> => {
  // If already connected, return
  if (isConnected && mongoose.connection.readyState === 1) {
    logger.info('Using existing database connection');
    return;
  }

  // If mongoose is currently connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
    });
    isConnected = true;
    return;
  }

  try {
    // Serverless-friendly mongoose options
    await mongoose.connect(config.mongoUri, {
      autoIndex: !config.isProd,
      bufferCommands: false, // Disable buffering for serverless
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    logger.info('MongoDB connected');

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      logger.info('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('error', (err) => {
      logger.error({ error: err }, 'MongoDB connection error');
      isConnected = false;
    });

  } catch (error) {
    logger.error({ error }, 'MongoDB connection error');
    isConnected = false;
    // DON'T use process.exit(1) in serverless - it kills the function
    // Instead, throw the error and let the caller handle it
    throw error;
  }
};