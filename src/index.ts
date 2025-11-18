import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from './app';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

// Cache the app and database connection
let app: ReturnType<typeof createApp> | null = null;
let isInitialized = false;

async function initializeApp() {
  if (isInitialized && app) {
    return app;
  }

  try {
    logger.info('Initializing serverless function...');
    
    // Connect to database
    await connectDatabase();
    
    // Create Express app
    app = createApp();
    isInitialized = true;
    
    logger.info('Serverless function initialized successfully');
    return app;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize serverless function');
    throw error;
  }
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await initializeApp();
    
    // Convert VercelRequest to Express-compatible request and handle it
    return expressApp(req as any, res as any);
  } catch (error) {
    logger.error({ error }, 'Serverless function error');
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error as Error)?.stack : undefined
    });
  }
}