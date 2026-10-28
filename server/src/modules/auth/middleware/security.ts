import type { RequestHandler } from "express";
import { AppError } from "../../../lib/errors.js";
import rateLimit from "express-rate-limit";


const limiterBase = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  handler: (() => {
    throw new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later');
  }) as RequestHandler,
};

export const credentialsLimiter = rateLimit({
  ...limiterBase,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
});

export const refreshLimiter = rateLimit({
  ...limiterBase,
  windowMs: 15 * 60 * 1000,
  limit: 60,
});

export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (req.get('x-requested-with') !== 'XMLHttpRequest') {
    throw new AppError(403, 'CSRF', 'Missing X-Requested-With header');
  }
  next();
};
