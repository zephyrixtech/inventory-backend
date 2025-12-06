import jwt, { type JwtPayload, type SignOptions, type Secret } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { config } from '../config/env';

export type TokenPayload = {
  sub: string;
  role: string;
  permissions?: string[];
};

const accessTokenOptions: SignOptions = {
  expiresIn: config.jwt.expiresIn as SignOptions['expiresIn']
};

const refreshTokenOptions: SignOptions = {
  expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn']
};

const accessTokenSecret: Secret = config.jwt.secret;
const refreshTokenSecret: Secret = config.jwt.refreshSecret;

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, accessTokenSecret, accessTokenOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, refreshTokenSecret, refreshTokenOptions);
};

export const verifyAccessToken = (token: string): TokenPayload & JwtPayload => {
  return jwt.verify(token, accessTokenSecret) as TokenPayload & JwtPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload & JwtPayload => {
  return jwt.verify(token, refreshTokenSecret) as TokenPayload & JwtPayload;
};

export const buildTokenPayload = (params: { userId: Types.ObjectId;  roleId: Types.ObjectId; permissions?: string[] }): TokenPayload => {
  return {
    sub: params.userId.toString(),
    role: params.roleId.toString(),
    permissions: params.permissions
  };
};

