import { StatusCodes, getReasonPhrase } from 'http-status-codes';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message?: string, options?: { isOperational?: boolean; details?: unknown }) {
    super(message || safeReasonPhrase(statusCode) || 'Error');
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    this.details = options?.details;
    Error.captureStackTrace(this);
  }

  static badRequest(message?: string, details?: unknown): ApiError {
    return new ApiError(StatusCodes.BAD_REQUEST, message, { details });
  }

  static unauthorized(message?: string, details?: unknown): ApiError {
    return new ApiError(StatusCodes.UNAUTHORIZED, message, { details });
  }

  static forbidden(message?: string, details?: unknown): ApiError {
    return new ApiError(StatusCodes.FORBIDDEN, message, { details });
  }

  static notFound(message?: string, details?: unknown): ApiError {
    return new ApiError(StatusCodes.NOT_FOUND, message, { details });
  }

  static conflict(message?: string, details?: unknown): ApiError {
    return new ApiError(StatusCodes.CONFLICT, message, { details });
  }
}

const safeReasonPhrase = (statusCode: number): string | undefined => {
  try {
    return getReasonPhrase(statusCode as StatusCodes);
  } catch {
    return undefined;
  }
};

