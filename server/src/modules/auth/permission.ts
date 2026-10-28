import type { Role } from "../../types/index.js";

export type Permission = 'profile:read' | 'content:moderate' | 'users:manage';

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  user: ['profile:read'],
  moderator: ['profile:read', 'content:moderate'],
  admin: ['profile:read', 'content:moderate', 'users:manage'],
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  return new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []));
}