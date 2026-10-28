import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import { config } from "../../config.js";
import { ROLES, type AuthUser, type Role } from "../../types/index.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import z from "zod";

const ALG='RS256';

const fromB64=(s:string)=>Buffer.from(s,'base64').toString('utf8');

let keys:Promise<{privateKey:CryptoKey; publicKey:CryptoKey;}>|undefined;
const getKeys = () =>
  (keys ??= (async () => ({
    privateKey: await importPKCS8(fromB64(config.JWT_PRIVATE_KEY_B64), ALG),
    publicKey: await importSPKI(fromB64(config.JWT_PUBLIC_KEY_B64), ALG),
  }))());

  export async function signAccessToken(user:{id:string; roles:Role[]}){
    const {privateKey}=await getKeys();
    const jti=randomUUID();

    const token=await new SignJWT({roles:user.roles})
    .setProtectedHeader({alg:ALG,kid:config.JWT_KEY_ID,typ:'JWT'})
    .setSubject(user.id)
    .setIssuer(config.JWT_ISSUER)
    .setAudience(config.JWT_AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(privateKey);

    return {token,jti,expiresIn:config.ACCESS_TOKEN_TTL_SECONDS};
  }
const claimsSchema=z.object({
  sub:z.string().min(1),
  jti:z.string().min(1),
  exp:z.number(),
  roles:z.array(z.enum(ROLES)),
});

export async function verifyAccessToken(token:string):Promise<AuthUser>{
  const {publicKey}=await getKeys();
  const {payload}=await jwtVerify(token,
    publicKey,{
      issuer:config.JWT_ISSUER,
      audience:config.JWT_AUDIENCE,
      algorithms:[ALG],
      clockTolerance:5,
    }
  );
  const claims=claimsSchema.parse(payload);
  return {id:claims.sub,roles:claims.roles,jti:claims.jti,exp:claims.exp};
}

export const generateRefreshToken=()=> randomBytes(32).toString('base64url');

export const hashRefreshToken=(raw:string)=> createHash('sha256').update(raw).digest('hex');
