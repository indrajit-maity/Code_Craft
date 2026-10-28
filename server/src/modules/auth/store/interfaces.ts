import {type RefreshTokenRecord,type User,type UserProfile } from "../../../types/index.js";


export interface UserStore{
  findById(id:string): Promise<UserProfile|null>;
  findByEmail(email:string):Promise<User|null>;
  create(user:User):Promise<void>;
}

export interface RefreshTokenStore{
  save(record:RefreshTokenRecord):Promise<void>;
  findByHash(tokenHash:string):Promise<RefreshTokenRecord|null>;
  markUsed(id:string):Promise<boolean>;
  revokeFamily(familyId:string):Promise<void>;
  revokeAllForUser(userId:string):Promise<void>;
  /** Deletes rows whose expiry has passed and returns how many were removed. */
  deleteExpired():Promise<number>;
}


export interface  AccessTokenDenylist{
  add(jti:string,expiresAtEpochSeconds:number):Promise<void>;
  has(jti:string):Promise<boolean>;
}