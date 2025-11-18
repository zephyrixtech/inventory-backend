import type { DestinationStream } from 'pino';
import pino from 'pino';

import { config } from '../config/env';

const getPrettyStream = (): DestinationStream | undefined => {
  if (config.isProd) {
    return undefined;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pretty = require('pino-pretty');
    return pretty({
      colorize: true,
      translateTime: 'SYS:standard'
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('pino-pretty is not available; falling back to JSON logs', error);
    return undefined;
  }
};

export const logger = pino(
  {
    level: config.isProd ? 'info' : 'debug'
  },
  getPrettyStream()
);

