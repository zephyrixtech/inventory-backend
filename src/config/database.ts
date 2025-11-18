import mongoose from 'mongoose';

import { logger } from '../utils/logger';

import { config } from './env';

mongoose.set('strictQuery', false);

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri, {
      autoIndex: !config.isProd
    });

    logger.info('MongoDB connected');
  } catch (error) {
    logger.error({ error }, 'MongoDB connection error');
    process.exit(1);
  }
};

