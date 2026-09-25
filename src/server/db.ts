import fs from 'fs';
import path from 'path';
import type {
  AppUser,
  Category,
  Item,
  PosSettings,
  Sale,
  Station,
  StockReceipt,
  Subcategory,
  Tax,
  WasteEvent,
} from '@/lib/types';
import { buildSeedData } from './seed';

export interface DbData {
  version: number;
  users: (AppUser & { passwordHash: string })[];
  sessions: { token: string; userId: string; expiresAt: string }[];
  categories: Category[];
  subcategories: Subcategory[];
  stations: Station[];
  taxes: Tax[];
  items: Item[];
  sales: Sale[];
  wasteEvents: WasteEvent[];
  stockReceipts: StockReceipt[];
  settings: PosSettings;
  ticketCounter: number;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'prostock.json');

const g = globalThis as unknown as { __prostockDb?: DbData };

/** Synchronous in-process store, persisted to a JSON file after each mutation. */
export function getDb(): DbData {
  if (!g.__prostockDb) {
    if (fs.existsSync(DATA_FILE)) {
      try {
        g.__prostockDb = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as DbData;
      } catch {
        g.__prostockDb = buildSeedData();
        persist();
      }
    } else {
      g.__prostockDb = buildSeedData();
      persist();
    }
  }
  return g.__prostockDb;
}

export function persist() {
  if (!g.__prostockDb) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(g.__prostockDb, null, 2));
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
