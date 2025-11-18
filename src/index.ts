import { Request, Response } from 'express';
import { createApp } from './app';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

let app: ReturnType<typeof createApp> | null = null;

const initApp = async () => {
  if (!app) {
    try {
      logger.info('Initializing serverless function...');
      await connectDatabase();
      app = createApp();
      logger.info('Serverless function initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize serverless function');
      throw error;
    }
  }
  return app;
};

// Export the Express app as a serverless function
export default async (req: Request, res: Response) => {
  try {
    const expressApp = await initApp();
    return expressApp(req, res);
  } catch (error) {
    logger.error({ error }, 'Serverless function invocation error');
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};