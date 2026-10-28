import type { Role } from "../../../types/index.js";
import { forbidden, unauthorized } from "../../../lib/errors.js";
import { type Permission, permissionsFor } from "../permission.js";
import type { RequestHandler } from "express";


export const requireRoles =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.some((r) => req.user!.roles.includes(r))) throw forbidden();
    next();
  };

  export const requirePermissions =
  (...perms: Permission[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    const granted = permissionsFor(req.user.roles);
    if (!perms.every((p) => granted.has(p))) throw forbidden();
    next();
  };
