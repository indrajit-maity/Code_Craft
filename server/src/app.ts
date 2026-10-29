import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import {pinoHttp} from "pino-http";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { authrouter } from "./routes/auth.routes.js";
import { errorHandler, notFound } from "./modules/auth/middleware/errorHandler.js";
import { adminRouter } from "./routes/admin.routes.js";

const app = express();


// Trust proxy configuration
app.set("trust proxy", config.TRUST_PROXY);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin:
      config.CORS_ORIGINS.length > 0
        ? config.CORS_ORIGINS
        : false,
    credentials: true,
    methods:['GET','POST','PUT','PATCH','DELETE'],
    allowedHeaders:['Content-Type','Authorization','X-Requested-With'],
  }),
);

// HTTP request logging
app.use(
  pinoHttp({
    logger,
  }),
);

// Request parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use('/api/auth',authrouter)
app.use('/api/auth/',adminRouter);
app.use(notFound);
app.use(errorHandler);

// Basic health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Code Review API is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});


// Global error handler
app.use(
  (
    error: Error & { statusCode?: number; status?: number; code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const statusCode = error.statusCode ?? error.status ?? 500;

    if (statusCode >= 400 && statusCode < 600) {
      if (statusCode >= 500) {
        logger.error({ err: error }, "Unhandled application error");
      } else {
        logger.warn({ err: error }, "Request failed");
      }

      res.status(statusCode).json({
        success: false,
        message:
          statusCode >= 500
            ? "Internal server error"
            : error.message,
        ...(error.code && {
          error: {
            code: error.code,
          },
        }),
      });

      return;
    }

    logger.error({ err: error }, "Unhandled application error");

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  },
);

export default app;