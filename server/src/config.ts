import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

loadEnv({
  path: path.resolve(currentDir, "../../.env"),
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  SERVER_PORT: z.coerce.number().int().positive().default(5001),

  LOG_LEVEL: z.string().default("info"),

  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // PostgreSQL
  DATABASE_URL: z
    .string()
    .regex(
      /^postgres(ql)?:\/\/.+/,
      "must start with postgres:// or postgresql://",
    ),

  // Redis
  REDIS_URL: z
    .string()
    .regex(
      /^rediss?:\/\//,
      "must start with redis:// or rediss://",
    ),

  USER_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  // JWT
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_KEY_ID: z.string().min(1).default("key-1"),
  JWT_PRIVATE_KEY_B64: z.string().min(1),
  JWT_PUBLIC_KEY_B64: z.string().min(1),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),

  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.flatten().fieldErrors,
  );

  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
} as const;