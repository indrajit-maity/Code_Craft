import { generateKeyPairSync } from 'node:crypto';
import { defineConfig } from 'vitest/config';

// Throw-away RSA key pair so the JWT code can sign and verify during tests.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const b64 = (pem: string) => Buffer.from(pem).toString('base64');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false, // tests share one database and one Redis
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Must be a dedicated test database: the tests delete every row.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:replace_with_a_strong_password@localhost:5433/authmig_test?schema=public',
      // REDIS_URL: process.env.REDIS_URL ?? 'redis://:codereview_redis_pw@127.0.0.1:6379',
      JWT_ISSUER: 'test-issuer',
      JWT_AUDIENCE: 'test-audience',
      JWT_PRIVATE_KEY_B64: b64(privateKey),
      JWT_PUBLIC_KEY_B64: b64(publicKey),
    },
  },
});
