import { prisma } from '../../../config/database.js';
import { AppError } from '../../../lib/errors.js';
import type { UserStore, RefreshTokenStore } from './interfaces.js';
import type { User, UserProfile, RefreshTokenRecord } from '../../../types/index.js';
import { Prisma } from '../../../../generated/prisma/index.js';

import type { $Enums, RefreshToken as DbRefreshToken,User as DbUser } from '../../../../generated/prisma/index.js';


const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isUniqueViolation = (
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  err.code === "P2002";

const toProfile = (d: Omit<DbUser, 'passwordHash'>): UserProfile => ({
  id: d.id,
  name: d.name,
  phone: d.phone,
  email: d.email,
  roles: d.roles,
  createdAt: d.createdAt,
});

const toRecord = (d: DbRefreshToken): RefreshTokenRecord => ({
  id: d.id,
  userId: d.userId,
  familyId: d.familyId,
  tokenHash: d.tokenHash,
  expiresAt: d.expiresAt,
  usedAt: d.usedAt ?? undefined,
  revokedAt: d.revokedAt ?? undefined,
  createdAt: d.createdAt,
  ip: d.ip ?? undefined,
  userAgent: d.userAgent ?? undefined,
});

export class PrismaUserStore implements UserStore{

  async findById(id: string): Promise<UserProfile | null> {
    const doc = await prisma.user.findUnique({ where: { id }, omit: { passwordHash: true } });
    return doc ? toProfile(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    return doc ? { ...toProfile(doc), passwordHash: doc.passwordHash } : null;
  }
  async create(user: User): Promise<void> {
    const email = normalizeEmail(user.email);
    try {
      await prisma.user.create({
        data: {
          id: user.id,
          name: user.name.trim(),
          phone: user.phone.trim(),
          email,
          passwordHash: user.passwordHash,
          roles: user.roles,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Ask the database which value collided rather than parsing driver-specific error
        // metadata, which differs between Prisma engines and adapters.
        const emailTaken = (await prisma.user.findUnique({ where: { email }, select: { id: true } })) !== null;
        throw emailTaken
          ? new AppError(409, 'EMAIL_TAKEN', 'Email already in use')
          : new AppError(409, 'PHONE_TAKEN', 'Phone number already in use');
      }
      throw err;
    }
  }
  
}

export class PrismaRefreshTokenStore implements RefreshTokenStore{

  async save(r: RefreshTokenRecord): Promise<void> {
    await prisma.refreshToken.create({
      data: {
        id: r.id,
        userId: r.userId,
        familyId: r.familyId,
        tokenHash: r.tokenHash,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        ip: r.ip?? null,
        userAgent: r.userAgent?? null,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const doc = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    return doc ? toRecord(doc) : null;
  }

  async markUsed(id: string): Promise<boolean> {
    const { count } = await prisma.refreshToken.updateMany({
      where: { id, usedAt: null, revokedAt: null },
      data: { usedAt: new Date() },
    });
    return count > 0;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const { count } = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return count;
  }

}