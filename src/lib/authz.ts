import { SessionUser } from './auth-server';

// Collections that only admin can write to
const ADMIN_ONLY_COLLECTIONS = ['users'];

// Collections that admin and stock-manager can write to
const STOCK_MANAGER_COLLECTIONS = [
  'items',
  'categories',
  'subcategories',
  'stations',
  'taxes',
  'staff',
  'settings',
];

// Collections that any authenticated user can create/write (POS operations)
const ANY_USER_COLLECTIONS = ['sales', 'wasteEvents', 'stockReceipts'];

/**
 * Check if a user can write (POST/PUT) to a given collection.
 * - admin: can write to everything
 * - stock-manager: can write to stock-manager collections + any-user collections
 * - other roles: can only write to any-user collections (sales, waste, stock receipts)
 */
export function canWrite(collection: string, user: SessionUser): boolean {
  if (user.role === 'admin') return true;

  if (ADMIN_ONLY_COLLECTIONS.includes(collection)) return false;

  if (STOCK_MANAGER_COLLECTIONS.includes(collection)) {
    return user.role === 'stock-manager';
  }

  if (ANY_USER_COLLECTIONS.includes(collection)) return true;

  return false;
}

/**
 * Check if a user can delete from a given collection.
 * Only admin can delete.
 */
export function canDelete(collection: string, user: SessionUser): boolean {
  return user.role === 'admin';
}
