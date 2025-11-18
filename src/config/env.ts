import dotenv from 'dotenv';

dotenv.config();

const env = process.env.NODE_ENV || 'development';

const requiredVariables = ['MONGODB_URI', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET'];

requiredVariables.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Environment variable ${key} is required but not defined`);
  }
});

export const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI as string,
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET as string,
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  },
  password: {
    saltRounds: Number(process.env.PASSWORD_SALT_ROUNDS || 10)
  }
} as const;

