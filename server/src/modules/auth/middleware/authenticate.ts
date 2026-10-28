import type { AccessTokenDenylist } from "../store/interfaces.js";
import { AppError, unauthorized } from "../../../lib/errors.js";
import { verifyAccessToken } from "../tokens.js";
import type { RequestHandler } from "express";


export function createAuthenticate (denylist:AccessTokenDenylist):RequestHandler{
  return async (req,_res,next)=>{
    const header=req.headers.authorization;
    if(!header?.startsWith('Bearer')) throw unauthorized('Missing bearer token');
    let user;
    try{
      user=await verifyAccessToken(header.slice(7));
    }
    catch{
      throw unauthorized('Invalid or expired access token','INVALID_ACCESS_TOKEN');
    }
    let revoked:boolean;
    try{
      revoked=await denylist.has(user.jti);
    }
    catch{
      throw new AppError(503,'Auth_UNAVAILABLE','Authentication temporarily unavailable');
    }
    if (revoked) throw unauthorized('Token has been revoked', 'TOKEN_REVOKED');
    req.user = user;
    next();
  }
}