import { randomUUID } from 'node:crypto';
import { prisma } from '../src/config/database';
// import { redis } from '../src/config/redis';
import type { RefreshTokenRecord, Role, User } from '../src/types';

let n = 0;

export function makeUser(overrides: Partial<User> = {}): User {
  n += 1;
  return {
    id: randomUUID(),
    name: `User ${n}`,
    phone: String(1000000000 + n),
    email: `user${n}@example.com`,
    passwordHash: '$argon2id$placeholder',
    roles: ['user'] as Role[],
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeToken(userId: string, overrides: Partial<RefreshTokenRecord> = {}): RefreshTokenRecord {
  n += 1;
  return {
    id: randomUUID(),
    userId,
    familyId: randomUUID(),
    tokenHash: `hash-${n}-${randomUUID()}`.slice(0, 64),
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    ...overrides,
  };
}

/** Safety net: every test run starts from empty tables, and only ever in a *_test database. */
export async function resetDatabase(): Promise<void> {
  const [{ current_database }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (!current_database.endsWith('_test')) {
    throw new Error(`Refusing to wipe "${current_database}": test databases must end in _test`);
  }
  await prisma.$executeRaw`TRUNCATE TABLE "refresh_tokens", "users" CASCADE`;
}

// export async function resetRedis(): Promise<void> {
//   const keys = await redis.keys('auth:*');
//   if (keys.length) await redis.del(...keys);
// }
