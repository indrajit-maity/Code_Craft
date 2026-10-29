import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase, prisma } from '../src/config/database';
import { Role as PrismaRole } from '../generated/prisma/index';
import { AppError } from '../src/lib/errors';
import { PrismaRefreshTokenStore, PrismaUserStore } from '../src/modules/auth/store/prisma';
import { ROLES } from '../src/types';
import { makeToken, makeUser, resetDatabase } from './helpers';

const users = new PrismaUserStore();
const tokens = new PrismaRefreshTokenStore();

beforeAll(connectDatabase);
beforeEach(resetDatabase);
afterAll(disconnectDatabase);

describe('schema stays in sync with the app', () => {
  it('Prisma Role enum matches ROLES in src/types', () => {
    expect(Object.values(PrismaRole).sort()).toEqual([...ROLES].sort());
  });
});

describe('PrismaUserStore', () => {
  it('creates a user and reads it back by id and by email', async () => {
    const u = makeUser({ roles: ['user', 'moderator'] });
    await users.create(u);

    const byId = await users.findById(u.id);
    expect(byId).toMatchObject({ id: u.id, name: u.name, phone: u.phone, email: u.email, roles: ['user', 'moderator'] });
    expect(byId?.createdAt).toBeInstanceOf(Date);

    const byEmail = await users.findByEmail(u.email);
    expect(byEmail?.id).toBe(u.id);
    expect(byEmail?.passwordHash).toBe(u.passwordHash);
  });

  it('never exposes the password hash from findById', async () => {
    const u = makeUser();
    await users.create(u);
    const profile = await users.findById(u.id);
    expect(profile).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(profile)).not.toContain('argon2');
  });

  it('returns null for unknown users', async () => {
    expect(await users.findById('00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await users.findByEmail('nobody@example.com')).toBeNull();
  });

  it('normalises email case and whitespace (replaces Mongoose lowercase/trim)', async () => {
    const u = makeUser({ email: '  Mixed.Case@Example.COM ' });
    await users.create(u);
    expect((await users.findByEmail('mixed.case@example.com'))?.email).toBe('mixed.case@example.com');
    expect((await users.findByEmail('MIXED.CASE@EXAMPLE.COM'))?.id).toBe(u.id);
  });

  it('defaults to the "user" role when none is given (database default)', async () => {
    const u = makeUser();
    await prisma.user.create({
      data: { id: u.id, name: u.name, phone: u.phone, email: u.email, passwordHash: u.passwordHash },
    });
    expect((await users.findById(u.id))?.roles).toEqual(['user']);
  });

  it('rejects a duplicate email with EMAIL_TAKEN, case-insensitively', async () => {
    await users.create(makeUser({ email: 'dup@example.com' }));
    const err = await users.create(makeUser({ email: 'DUP@example.com' })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  it('rejects a duplicate phone with PHONE_TAKEN', async () => {
    await users.create(makeUser({ phone: '5551234567' }));
    const err = await users.create(makeUser({ phone: '5551234567' })).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 409, code: 'PHONE_TAKEN' });
  });

  it('lets exactly one of two concurrent registrations with the same email win', async () => {
    const results = await Promise.allSettled([
      users.create(makeUser({ email: 'race@example.com' })),
      users.create(makeUser({ email: 'race@example.com' })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ code: 'EMAIL_TAKEN' });
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('PrismaRefreshTokenStore', () => {
  it('saves and finds a token, mapping null columns to undefined', async () => {
    const u = makeUser();
    await users.create(u);
    const t = makeToken(u.id, { ip: '10.0.0.1', userAgent: 'jest' });
    await tokens.save(t);

    const found = await tokens.findByHash(t.tokenHash);
    expect(found).toEqual({ ...t, usedAt: undefined, revokedAt: undefined });
    expect(await tokens.findByHash('unknown')).toBeNull();
  });

  it('stores tokens without ip or user agent', async () => {
    const u = makeUser();
    await users.create(u);
    const t = makeToken(u.id);
    await tokens.save(t);
    const found = await tokens.findByHash(t.tokenHash);
    expect(found?.ip).toBeUndefined();
    expect(found?.userAgent).toBeUndefined();
  });

  it('truncates over-long ip / user-agent instead of failing the login', async () => {
    const u = makeUser();
    await users.create(u);
    const t = makeToken(u.id, { ip: 'x'.repeat(200), userAgent: 'Mozilla/'.repeat(500) });
    await expect(tokens.save(t)).resolves.toBeUndefined();
    const found = await tokens.findByHash(t.tokenHash);
    expect(found?.ip).toHaveLength(64);
    expect(found?.userAgent).toHaveLength(512);
  });

  it('refuses a token for a user that does not exist (foreign key)', async () => {
    await expect(tokens.save(makeToken('00000000-0000-4000-8000-000000000000'))).rejects.toThrow();
  });

  it('markUsed succeeds once, then reports false', async () => {
    const u = makeUser();
    await users.create(u);
    const t = makeToken(u.id);
    await tokens.save(t);

    expect(await tokens.markUsed(t.id)).toBe(true);
    expect(await tokens.markUsed(t.id)).toBe(false);
    expect((await tokens.findByHash(t.tokenHash))?.usedAt).toBeInstanceOf(Date);
  });

  it('markUsed is atomic: 25 simultaneous claims produce exactly one winner', async () => {
    const u = makeUser();
    await users.create(u);
    const t = makeToken(u.id);
    await tokens.save(t);

    const results = await Promise.all(Array.from({ length: 25 }, () => tokens.markUsed(t.id)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('markUsed refuses revoked tokens and unknown ids', async () => {
    const u = makeUser();
    await users.create(u);
    const t = makeToken(u.id);
    await tokens.save(t);
    await tokens.revokeFamily(t.familyId);
    expect(await tokens.markUsed(t.id)).toBe(false);
    expect(await tokens.markUsed('00000000-0000-4000-8000-000000000000')).toBe(false);
  });

  it('revokeFamily only touches that family and keeps the original timestamp', async () => {
    const u = makeUser();
    await users.create(u);
    const a1 = makeToken(u.id);
    const a2 = makeToken(u.id, { familyId: a1.familyId });
    const b = makeToken(u.id);
    await Promise.all([a1, a2, b].map((t) => tokens.save(t)));

    await tokens.revokeFamily(a1.familyId);
    const first = (await tokens.findByHash(a1.tokenHash))?.revokedAt;
    expect(first).toBeInstanceOf(Date);
    expect((await tokens.findByHash(a2.tokenHash))?.revokedAt).toBeInstanceOf(Date);
    expect((await tokens.findByHash(b.tokenHash))?.revokedAt).toBeUndefined();

    await new Promise((r) => setTimeout(r, 15));
    await tokens.revokeFamily(a1.familyId);
    expect((await tokens.findByHash(a1.tokenHash))?.revokedAt).toEqual(first);
  });

  it('revokeAllForUser revokes every family of that user only', async () => {
    const u1 = makeUser();
    const u2 = makeUser();
    await users.create(u1);
    await users.create(u2);
    const t1 = makeToken(u1.id);
    const t2 = makeToken(u1.id);
    const other = makeToken(u2.id);
    await Promise.all([t1, t2, other].map((t) => tokens.save(t)));

    await tokens.revokeAllForUser(u1.id);
    expect((await tokens.findByHash(t1.tokenHash))?.revokedAt).toBeInstanceOf(Date);
    expect((await tokens.findByHash(t2.tokenHash))?.revokedAt).toBeInstanceOf(Date);
    expect((await tokens.findByHash(other.tokenHash))?.revokedAt).toBeUndefined();
  });

  it('deleteExpired removes only expired rows and reports the count (replaces the TTL index)', async () => {
    const u = makeUser();
    await users.create(u);
    const expired1 = makeToken(u.id, { expiresAt: new Date(Date.now() - 1_000) });
    const expired2 = makeToken(u.id, { expiresAt: new Date(Date.now() - 86_400_000) });
    const live = makeToken(u.id);
    await Promise.all([expired1, expired2, live].map((t) => tokens.save(t)));

    expect(await tokens.deleteExpired()).toBe(2);
    expect(await tokens.findByHash(expired1.tokenHash)).toBeNull();
    expect(await tokens.findByHash(expired2.tokenHash)).toBeNull();
    expect(await tokens.findByHash(live.tokenHash)).not.toBeNull();
    expect(await tokens.deleteExpired()).toBe(0);
  });

  it('deleting a user cascades to their refresh tokens', async () => {
    const u = makeUser();
    await users.create(u);
    const t = makeToken(u.id);
    await tokens.save(t);
    await prisma.user.delete({ where: { id: u.id } });
    expect(await tokens.findByHash(t.tokenHash)).toBeNull();
  });
});
