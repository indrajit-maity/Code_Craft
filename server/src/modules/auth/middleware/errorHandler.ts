import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../../../lib/errors.js";
import { logger } from "../../../lib/logger.js";



export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export const errorHandler:ErrorRequestHandler=(err,req,res,_next)=>{
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ error: { code: 'BAD_REQUEST', message: 'Bad request' } });
    return;
  }


  logger.error({ err, method: req.method, url: req.originalUrl }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}