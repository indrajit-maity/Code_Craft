import { AppError } from "../../../lib/errors.js";
import type { RefreshTokenRecord,User } from "../../../types/index.js";
import type { AccessTokenDenylist,RefreshTokenStore,UserStore } from "./interfaces.js";


export class MemoryUserStore implements UserStore{

  private byId = new Map<string, User>();
  private byEmail = new Map<string, User>();

  async findById(id: string) {
    return this.byId.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return this.byEmail.get(email) ?? null;
  }
  async create(user: User) {
    if (this.byEmail.has(user.email)) throw new AppError(409, 'EMAIL_TAKEN', 'Email already in use');
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user);
  }
}

export class MemoryRefreshTokenStore implements RefreshTokenStore{
  private records = new Map<string, RefreshTokenRecord>();
  private byHash = new Map<string, string>();

  constructor() {
    const timer = setInterval(() => this.purgeExpired(), 10 * 60 * 1000);
    timer.unref();
  }
  private purgeExpired() {
    const now = Date.now();
    let removed = 0;
    for (const [id, r] of this.records) {
      if (r.expiresAt.getTime() < now) {
        this.records.delete(id);
        this.byHash.delete(r.tokenHash);
        removed++;
      }
    }
    return removed;
  }
  async save(record: RefreshTokenRecord) {
    this.records.set(record.id, record);
    this.byHash.set(record.tokenHash, record.id);
  }
  async findByHash(tokenHash: string) {
    const id = this.byHash.get(tokenHash);
    return id ? (this.records.get(id) ?? null) : null;
  }
  async markUsed(id: string) {
    const r = this.records.get(id);
    if (!r || r.usedAt || r.revokedAt) return false;
    r.usedAt = new Date();
    return true;
  }
  async revokeFamily(familyId: string) {
    const now = new Date();
    for (const r of this.records.values()) {
      if (r.familyId === familyId) r.revokedAt ??= now;
    }
  }
  async revokeAllForUser(userId: string) {
    const now = new Date();
    for (const r of this.records.values()) {
      if (r.userId === userId) r.revokedAt ??= now;
    }
  }
  async deleteExpired() {
    return this.purgeExpired();
  }
}

export class MemoryDenylist implements AccessTokenDenylist{
  private entries = new Map<string, number>();
  constructor() {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      for (const [jti, exp] of this.entries) if (exp <= now) this.entries.delete(jti);
    }, 60 * 1000);
    timer.unref();
  }
  async add(jti: string, expiresAtEpochSeconds: number) {
    this.entries.set(jti, expiresAtEpochSeconds);
  }
  async has(jti: string) {
    return this.entries.has(jti);
  }
}