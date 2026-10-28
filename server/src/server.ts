import type { Server } from "node:http";
import pino from "pino";

import app from "./app.js";
import { config } from "./config.js";
import { prisma } from "./config/database.js";
import { logger } from "./lib/logger.js";



let httpServer: Server | undefined;
let isShuttingDown = false;

async function startServer(): Promise<void> {
  try {
    // Establish the PostgreSQL connection
    await prisma.$connect();

    logger.info("PostgreSQL connected successfully");

    // Start the HTTP server only after the DB connection succeeds
    httpServer = app.listen(config.SERVER_PORT, () => {
      logger.info(
        {
          port: config.SERVER_PORT,
          environment: config.NODE_ENV,
        },
        "Code Review API server started",
      );
    });

    httpServer.on("error", (error) => {
      logger.error({ err: error }, "HTTP server error");
      process.exitCode = 1;

      void shutdown();
    });
  } catch (error) {
    logger.fatal({ err: error }, "Failed to start server");

    await prisma.$disconnect().catch((disconnectError: unknown) => {
      logger.error(
        { err: disconnectError },
        "Failed to disconnect Prisma",
      );
    });

    process.exitCode = 1;
  }
}

async function shutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info("Graceful shutdown started");

  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    await prisma.$disconnect();

    logger.info("Graceful shutdown completed");
  } catch (error) {
    logger.error({ err: error }, "Error during graceful shutdown");
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

void startServer();