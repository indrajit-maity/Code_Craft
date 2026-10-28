import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import {pinoHttp} from "pino-http";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { authrouter } from "./routes/auth.routes.js";
import { NOTFOUND } from "node:dns";

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
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err: error }, "Unhandled application error");

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  },
);

export default app;