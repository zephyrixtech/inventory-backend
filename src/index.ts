import type { Express } from 'express';
import type { IncomingMessage, RequestListener, ServerResponse } from 'http';
import { config } from './config/env';
import { connectDatabase } from './config/database';
import { createApp } from './app';
import { logger } from './utils/logger';

type ExpressRequestListener = Express & RequestListener;

let appPromise: Promise<ExpressRequestListener> | null = null;

const getApp = async (): Promise<ExpressRequestListener> => {
  if (!appPromise) {
    appPromise = (async () => {
      await connectDatabase();
      return createApp() as ExpressRequestListener;
    })().catch((error) => {
      appPromise = null;
      logger.error({ error }, 'Failed to initialize application');
      throw error;
    });
  }

  return appPromise;
};

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>
) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    logger.error({ error }, 'Unhandled error in request handler');
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ success: false, message: 'Internal Server Error' }));
    }
  }
}

if (require.main === module) {
  (async () => {
    const app = await getApp();

    app.listen(config.port, () => {
      logger.info(`Server listening on port ${config.port}`);
    });
  })().catch((error) => {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  });
}

module.exports = handler;
