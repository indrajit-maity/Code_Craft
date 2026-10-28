import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { AuthService } from "../modules/auth/authService.js";
import { MemoryDenylist } from "../modules/auth/store/memory.js";
import { PrismaRefreshTokenStore, PrismaUserStore } from "../modules/auth/store/prisma.js";
import { credentialsLimiter, refreshLimiter, requireCsrfHeader } from "../modules/auth/middleware/security.js";
import { createAuthenticate } from "../modules/auth/middleware/authenticate.js";


const denylist=new MemoryDenylist();
const users=new PrismaUserStore();
const refreshTokens=new PrismaRefreshTokenStore();
const authService=new AuthService(users,refreshTokens,denylist);
const authController=new  AuthController(authService);
const authenticate=createAuthenticate(denylist);

export const authrouter=Router();

//public
authrouter.post('/register',authController.register);
authrouter.post('/login',credentialsLimiter,authController.login);

//Cookie-based
authrouter.post('/refresh',refreshLimiter,authController.refresh);
authrouter.post('/logout',requireCsrfHeader,authController.logout);

// Bearer token required
authrouter.post('/logout-all',authenticate, authController.logoutAll);
authrouter.get('/me',authenticate, authController.me);