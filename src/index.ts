import { config } from './config/env';
import { connectDatabase } from './config/database';
import { createApp } from './app';
import { logger } from './utils/logger';

const bootstrap = async () => {
  await connectDatabase();

  const app = createApp();

  app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`);
  });
};

void bootstrap();

