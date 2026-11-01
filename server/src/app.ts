import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
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
    origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// HTTP request logging (health checks run every few seconds, so skip them)
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/api/health" },
  }),
);

// Request parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());

// Health check: must be registered BEFORE notFound, or it is never reached.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Code Review API is running",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authrouter);
app.use("/api/auth", adminRouter);

// Must stay last: 404 for unknown routes, then the single error handler.
app.use(notFound);
app.use(errorHandler);

export default app;