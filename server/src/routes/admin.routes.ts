import { Router } from "express";
import { createAuthenticate } from "../modules/auth/middleware/authenticate.js";
import { MemoryDenylist } from "../modules/auth/store/memory.js";
import { requirePermissions, requireRoles } from "../modules/auth/middleware/authorize.js";


const denylist=new MemoryDenylist();
const authenticate=createAuthenticate(denylist);
export const adminRouter = Router();
adminRouter.use(authenticate); 
// Role-based
adminRouter.get('/dashboard', requireRoles('admin'), (req, res) => {
  res.json({ message: `Welcome, admin ${req.user!.id}` });
});
adminRouter.post('/moderate/:postId', requirePermissions('content:moderate'), (req, res) => {
  res.json({ message: `Post ${req.params.postId} moderated by ${req.user!.id}` });
});