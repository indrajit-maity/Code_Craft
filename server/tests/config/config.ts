import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(currentDir, "../../../.env");

const result = loadEnv({ path: envPath });

console.log("Resolved .env path:", envPath);
console.log("Variables parsed:", Object.keys(result.parsed ?? {}).length);
console.log("Dotenv error:", result.error?.message ?? "none");