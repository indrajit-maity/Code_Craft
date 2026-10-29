import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/index.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

console.log(config.DATABASE_URL);
const adapter = new PrismaPg(
  {
    connectionString: config.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5_000, // fail fast instead of hanging when the DB is unreachable
    idleTimeoutMillis: 30_000,
  },
  {
    onPoolError: (err) => logger.error({ err }, 'postgres pool error'),
    onConnectionError: (err) => logger.error({ err }, 'postgres connection error'),
  },
);

export const prisma = new PrismaClient({
  adapter,
  log: config.isProd ? [] : ['warn'],
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`; 
  logger.info('postgres connected');
}

export const disconnectDatabase = () => prisma.$disconnect();
