import type { Role } from './types';

/** Routes each role may access (PRD flow 1). */
export const ROLE_ROUTES: Record<Role, string[]> = {
  admin: ['/dashboard', '/items', '/stock', '/stock-activity', '/sales', '/reports', '/kds', '/bar', '/settings'],
  manager: ['/dashboard', '/items', '/stock', '/sales', '/reports', '/kds', '/bar', '/settings'],
  'stock-manager': ['/stock', '/stock-activity', '/kds', '/bar'],
  user: ['/dashboard', '/sales', '/kds', '/bar'],
};

export const DEFAULT_ROUTE: Record<Role, string> = {
  admin: '/dashboard',
  manager: '/dashboard',
  'stock-manager': '/stock',
  user: '/dashboard',
};

export function canAccess(role: Role, path: string): boolean {
  const routes = ROLE_ROUTES[role] ?? [];
  return routes.some((route) => path === route || path.startsWith(route + '/'));
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  'stock-manager': 'Stock Manager',
  user: 'Cashier',
};
