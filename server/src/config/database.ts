import { PrismaPg } from "@prisma/adapter-pg";
import {PrismaClient} from "../../generated/prisma/index.js"
import { config } from "../config.js";

console.log(config.DATABASE_URL);
const adapter = new PrismaPg({
  connectionString: config.DATABASE_URL,
});

export const prisma = new PrismaClient({
  adapter,
});