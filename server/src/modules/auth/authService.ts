import { randomUUID } from "node:crypto";
import { AppError, unauthorized } from "../../lib/errors.js";
import type { AuthUser, PublicUser, RequestMeta, User, UserProfile } from "../../types/index.js";
import type { AccessTokenDenylist, RefreshTokenStore, UserStore } from "./store/interfaces.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "./tokens.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";


export interface Session{
  accessToken:string;
  expiresIn:number;
  refreshToken:string;
  user:PublicUser
}
const toPublic=(u:UserProfile): PublicUser=>({id:u.id,name:u.name,phone:u.phone,email:u.email,roles:u.roles});

const INVALID_REFRESH=()=>
  unauthorized('Invalid or expired refresh token','INVALID_REFRESH_TOKEN');

export class AuthService{
  constructor(
    private readonly users:UserStore,
    private readonly refreshTokens:RefreshTokenStore,
    private readonly denylist:AccessTokenDenylist,
  ){}

  async register(email:string,password:string,name:string,phone:string):Promise<PublicUser>{
    const user: User = {
      id: randomUUID(),
      email: email.trim().toLowerCase(),
      name,
      phone,
      passwordHash: await hashPassword(password),
      roles: ['user'],
      createdAt: new Date(),
    };
    await this.users.create(user);
    return toPublic(user);
  }

  async login(email:string,password:string,meta:RequestMeta):Promise<Session>{
    const user=await this.users.findByEmail(email);
    const ok=await verifyPassword(user?.passwordHash??null,password);
    if(!user||!ok){
      throw unauthorized('Invalid email or password','INVALID_CREDENTIALS');
    }
    return this.issueSession(user,randomUUID(),meta);
  }
  private async issueSession(user: UserProfile, familyId: string, meta: RequestMeta): Promise<Session> {
    const access = await signAccessToken(user);
    const refreshToken = generateRefreshToken();
    const now = Date.now();

    await this.refreshTokens.save({
      id: randomUUID(),
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(now + config.REFRESH_TOKEN_TTL_SECONDS * 1000),
      createdAt: new Date(now),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken,
      user: toPublic(user),
    };
  }

  async refresh(rawToken:string,meta:RequestMeta):Promise<Session>{
    const record=await this.refreshTokens.findByHash(hashRefreshToken(rawToken));
    if(!record) throw INVALID_REFRESH();
    if(record.usedAt||record.revokedAt){
      await this.refreshTokens.revokeFamily(record.familyId);
      logger.warn({userId:record.userId,familyId:record.familyId,ip:meta.ip},'refresh token reuse detected');
      throw INVALID_REFRESH()
    }
    if (record.expiresAt.getTime() <= Date.now()) throw INVALID_REFRESH();
    const claimed = await this.refreshTokens.markUsed(record.id);
    if (!claimed) {
      await this.refreshTokens.revokeFamily(record.familyId);
      throw INVALID_REFRESH();
    }
    const user = await this.users.findById(record.userId);
    if (!user) throw INVALID_REFRESH();

    return this.issueSession(user, record.familyId, meta);
  }
  async logout(rawRefreshToken: string | undefined, access?: AuthUser): Promise<void> {
    if (rawRefreshToken) {
      const record = await this.refreshTokens.findByHash(hashRefreshToken(rawRefreshToken));
      if (record) await this.refreshTokens.revokeFamily(record.familyId);
    }
    if (access) await this.denylist.add(access.jti, access.exp);
  }

  async logoutAll(userId: string, access: AuthUser): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
    await this.denylist.add(access.jti, access.exp);
  }
  async getUser(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return toPublic(user);
  }

}