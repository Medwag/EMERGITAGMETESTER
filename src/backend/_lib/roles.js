// src/backend/_lib/roles.js
// Centralized role constants and lightweight helpers.
// NOTE: Role resolution varies by site setup. These helpers focus on
// readable checks and keep integration points small.

export const Roles = {
  SITE_OWNER: 'Site Owner',
  ADMIN: 'Admin',
  SUPPORT: 'Support',
  STAFF: 'Staff',
  PAYMENTS_MANAGER: 'Payments Manager'
};

/**
 * Simple predicate with an array of role names for the user.
 * You can plug your own role-fetching logic at call sites.
 */
export function hasAnyRole(userRoles = [], ...required) {
  const set = new Set((userRoles || []).map(String));
  return required.some(r => set.has(String(r)));
}

export function canManagePayments(userRoles = []) {
  return hasAnyRole(userRoles, Roles.SITE_OWNER, Roles.ADMIN, Roles.PAYMENTS_MANAGER, Roles.STAFF);
}

export function isAdmin(userRoles = []) {
  return hasAnyRole(userRoles, Roles.SITE_OWNER, Roles.ADMIN);
}

export default {
  Roles,
  hasAnyRole,
  canManagePayments,
  isAdmin
};

