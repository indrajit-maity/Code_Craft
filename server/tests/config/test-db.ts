import { prisma } from "./../../src/config/database";


async function testDatabaseConnection() {
  try {
    await prisma.$connect();

    const result = await prisma.$queryRaw<
      Array<{ version: string }>
    >`SELECT version()`;

    console.log("PostgreSQL connected successfully!");
    console.log(result[0]?.version);
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

await testDatabaseConnection();