import type { CookieOptions, RequestHandler } from "express";
import { config } from "../config.js";
import z from "zod";
import type { Request, Response } from "express";
import type { AuthService, Session } from "../modules/auth/authService.js";
import { unauthorized } from "../lib/errors.js";


const REFRESH_COOKIE='refresh_token';

const cookieoptions:CookieOptions={
  httpOnly:true,
  secure:config.isProd,
  sameSite:'strict',
  path:'/api/auth',
  maxAge:config.REFRESH_TOKEN_TTL_SECONDS*1000,
};
const clearCookieOptions:CookieOptions={...cookieoptions,maxAge:undefined}

const email=z
.string()
.trim()
.toLowerCase()
.email()
.max(254);

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email,
  phone: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone number must be 10 digits"),

  password: z.string().min(12, 'password must be at least 12 character').max(128),
});

const loginSchema=z.object({
  email,
  password:z.string().min(1).max(128),
});

const meta=(req:Request)=>({
  ip:req.ip,userAgent:req.get('user-agent')
});

function sendSession(res:Response,session:Session){
  res.cookie(REFRESH_COOKIE,session.refreshToken,cookieoptions);
  res.json({
    accessToken:session.accessToken,
    tokenType:'Bearer',
    expiresIn:session.expiresIn,
    user:session.user,
  });
}

export class AuthController{
  constructor(private readonly auth:AuthService){}
  register: RequestHandler = async (req, res) => {
    const body = registerSchema.parse(req.body ?? {});
    const user = await this.auth.register(body.email, body.password,body.name,body.phone);
    res.status(201).json({ user });
  };
  login: RequestHandler = async (req, res) => {
    const body = loginSchema.parse(req.body ?? {});
    sendSession(res, await this.auth.login(body.email, body.password, meta(req)));
  };
  refresh: RequestHandler = async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (typeof raw !== 'string' || !raw) {
      throw unauthorized('Missing refresh token', 'INVALID_REFRESH_TOKEN');
    }

    try {
      sendSession(res, await this.auth.refresh(raw, meta(req)));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, clearCookieOptions);
      throw err;
    }
  };
  logout: RequestHandler = async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    await this.auth.logout(typeof raw === 'string' ? raw : undefined, undefined);
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions);
    res.status(204).end();
  };
  logoutAll: RequestHandler = async (req, res) => {
    await this.auth.logoutAll(req.user!.id, req.user!);
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions);
    res.status(204).end();
  };
  me: RequestHandler = async (req, res) => {
    res.json({ user: await this.auth.getUser(req.user!.id) });
  };
}