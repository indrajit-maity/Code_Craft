export const ROLES = ['user', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  name:string;
  phone:string;
  email: string;
  passwordHash: string;
  roles: Role[];
  createdAt: Date;
}
export type UserProfile = Omit<User, 'passwordHash'>;
export interface AuthUser {
  id: string;
  // name:string;
  // phone:string;
  roles: Role[];
  jti: string;
  exp: number;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | undefined;
  revokedAt?: Date|undefined;
  createdAt: Date;
  ip?: string|undefined;
  userAgent?: string|undefined;
}

export interface RequestMeta {
  ip?: string|undefined;
  userAgent?: string|undefined;
}

export interface PublicUser {
  id: string;
  name:string;
  phone:string;
  email: string;
  roles: Role[];
}
