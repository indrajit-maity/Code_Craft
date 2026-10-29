import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase, prisma } from '../src/config/database';
import { AuthService } from '../src/modules/auth/authService';
import { MemoryDenylist } from '../src/modules/auth/store/memory';
import { PrismaRefreshTokenStore, PrismaUserStore } from '../src/modules/auth/store/prisma';
import { hashRefreshToken, verifyAccessToken } from '../src/modules/auth/tokens';
import { resetDatabase } from './helpers.ts';

const PASSWORD = 'correct horse battery staple';
const meta = { ip: '203.0.113.7', userAgent: 'vitest' };

const tokens = new PrismaRefreshTokenStore();
const denylist = new MemoryDenylist();
const auth = new AuthService(new PrismaUserStore(), tokens, denylist);

let seq = 0;
async function registerAndLogin(roles?: never) {
  seq += 1;
  const email = `svc${seq}@example.com`;
  const user = await auth.register(email, PASSWORD, 'Svc User', String(2000000000 + seq));
  const session = await auth.login(email, PASSWORD, meta);
  return { user, session, email, roles };
}

beforeAll(connectDatabase);
beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('register / login', () => {
  it('registers a public user and stores only an Argon2id hash', async () => {
    const user = await auth.register('Ann@Example.com', PASSWORD, 'Ann', '3000000001');
    expect(user).toMatchObject({ email: 'ann@example.com', name: 'Ann', roles: ['user'] });
    expect(user).not.toHaveProperty('passwordHash');

    const row = await prisma.user.findUniqueOrThrow({ where: { email: 'ann@example.com' } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('logs in and issues a verifiable access token plus a stored refresh token', async () => {
    const { user, session } = await registerAndLogin();
    const claims = await verifyAccessToken(session.accessToken);
    expect(claims).toMatchObject({ id: user.id, roles: ['user'] });

    // Only the hash of the refresh token is persisted, never the token itself.
    const rows = await prisma.refreshToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashRefreshToken(session.refreshToken));
    expect(JSON.stringify(rows)).not.toContain(session.refreshToken);
    expect(rows[0]).toMatchObject({ ip: meta.ip, userAgent: meta.userAgent });
  });

  it('treats a wrong password and an unknown email identically', async () => {
    const { email } = await registerAndLogin();
    for (const attempt of [auth.login(email, 'wrong password!!', meta), auth.login('nobody@example.com', PASSWORD, meta)]) {
      await expect(attempt).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    }
  });

  it('is case-insensitive for the login email', async () => {
    const { email } = await registerAndLogin();
    await expect(auth.login(email.toUpperCase(), PASSWORD, meta)).resolves.toHaveProperty('accessToken');
  });
});

describe('refresh token rotation', () => {
  it('rotates: the old token is marked used and the new one joins the same family', async () => {
    const { session } = await registerAndLogin();
    const next = await auth.refresh(session.refreshToken, meta);

    expect(next.refreshToken).not.toBe(session.refreshToken);
    const oldRow = await tokens.findByHash(hashRefreshToken(session.refreshToken));
    const newRow = await tokens.findByHash(hashRefreshToken(next.refreshToken));
    expect(oldRow?.usedAt).toBeInstanceOf(Date);
    expect(newRow?.usedAt).toBeUndefined();
    expect(newRow?.familyId).toBe(oldRow?.familyId);
  });

  it('can keep rotating', async () => {
    const { session } = await registerAndLogin();
    const second = await auth.refresh(session.refreshToken, meta);
    const third = await auth.refresh(second.refreshToken, meta);
    expect(await verifyAccessToken(third.accessToken)).toBeTruthy();
  });

  it('detects reuse of an old token and revokes the whole family, including the newest token', async () => {
    const { session } = await registerAndLogin();
    const next = await auth.refresh(session.refreshToken, meta);

    await expect(auth.refresh(session.refreshToken, meta)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
    await expect(auth.refresh(next.refreshToken, meta)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('rejects unknown tokens', async () => {
    await expect(auth.refresh('not-a-real-token', meta)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('rejects expired tokens without revoking anything', async () => {
    const { session } = await registerAndLogin();
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } });
    await expect(auth.refresh(session.refreshToken, meta)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect((await prisma.refreshToken.findFirstOrThrow()).revokedAt).toBeNull();
  });

  it('lets exactly one of two simultaneous refreshes with the same token succeed', async () => {
    const { session } = await registerAndLogin();
    const results = await Promise.allSettled([
      auth.refresh(session.refreshToken, meta),
      auth.refresh(session.refreshToken, meta),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('picks up role changes on the next refresh', async () => {
    const { user, session } = await registerAndLogin();
    await prisma.user.update({ where: { id: user.id }, data: { roles: ['user', 'admin'] } });

    const next = await auth.refresh(session.refreshToken, meta);
    expect(next.user.roles).toEqual(['user', 'admin']);
    expect((await verifyAccessToken(next.accessToken)).roles).toEqual(['user', 'admin']);
  });

  it('fails when the user was deleted (cascade removed their tokens too)', async () => {
    const { user, session } = await registerAndLogin();
    await prisma.user.delete({ where: { id: user.id } });
    await expect(auth.refresh(session.refreshToken, meta)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });
});

describe('logout', () => {
  it('logout revokes the token family so it can no longer be refreshed', async () => {
    const { session } = await registerAndLogin();
    await auth.logout(session.refreshToken, undefined);
    await expect(auth.refresh(session.refreshToken, meta)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('logout tolerates a missing or unknown refresh token', async () => {
    await expect(auth.logout(undefined, undefined)).resolves.toBeUndefined();
    await expect(auth.logout('unknown', undefined)).resolves.toBeUndefined();
  });

  it('logoutAll revokes every session of the user and denylists the access token', async () => {
    const { user, session, email } = await registerAndLogin();
    const otherDevice = await auth.login(email, PASSWORD, meta);
    const access = await verifyAccessToken(session.accessToken);

    await auth.logoutAll(user.id, access);

    for (const s of [session, otherDevice]) {
      await expect(auth.refresh(s.refreshToken, meta)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    }
    expect(await denylist.has(access.jti)).toBe(true);
  });

  it('getUser returns the public profile or 404', async () => {
    const { user } = await registerAndLogin();
    expect(await auth.getUser(user.id)).toMatchObject({ id: user.id });
    await expect(auth.getUser('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ status: 404 });
  });
});
