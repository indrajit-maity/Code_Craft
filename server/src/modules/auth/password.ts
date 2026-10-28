import argon2 from 'argon2';

const OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain: string) => argon2.hash(plain, OPTIONS);

let dummyHash: Promise<string> | undefined;

export async function verifyPassword(hash: string | null, plain: string): Promise<boolean> {
  if (hash === null) {
    dummyHash ??= argon2.hash('dummy-password-for-timing', OPTIONS);
    await argon2.verify(await dummyHash, plain).catch(() => false);
    return false;
  }
  return argon2.verify(hash, plain).catch(() => false);
}
