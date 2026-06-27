import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import type { Item, ItemInput, Location } from '@/types/item';

/**
 * Single source of truth for all persistence. Screens never touch SQLite
 * directly — they call the exported functions here (PROJECT.md §8).
 */

const DB_NAME = 'pantry.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      barcode TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'pcs',
      location TEXT NOT NULL DEFAULT 'fridge',
      expiryDate TEXT NOT NULL,
      addedDate TEXT NOT NULL,
      imageUrl TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

type ItemRow = {
  id: string;
  name: string;
  barcode: string | null;
  quantity: number;
  unit: string;
  location: string;
  expiryDate: string;
  addedDate: string;
  imageUrl: string | null;
};

function rowToItem(row: ItemRow): Item {
  return { ...row, location: row.location as Location };
}

/**
 * All items, expired first, then soonest expiry. SQLite sorts the ISO date
 * strings lexicographically, which matches chronological order.
 */
export async function listItems(): Promise<Item[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items ORDER BY expiryDate ASC`,
  );
  return rows.map(rowToItem);
}

export async function getItem(id: string): Promise<Item | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>(`SELECT * FROM items WHERE id = ?`, id);
  return row ? rowToItem(row) : null;
}

export async function addItem(input: ItemInput): Promise<Item> {
  const db = await getDb();
  const item: Item = {
    ...input,
    id: Crypto.randomUUID(),
    addedDate: new Date().toISOString().slice(0, 10),
  };
  await db.runAsync(
    `INSERT INTO items (id, name, barcode, quantity, unit, location, expiryDate, addedDate, imageUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.name,
    item.barcode,
    item.quantity,
    item.unit,
    item.location,
    item.expiryDate,
    item.addedDate,
    item.imageUrl,
  );
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<ItemInput>,
): Promise<void> {
  const fields = Object.keys(patch) as (keyof ItemInput)[];
  if (fields.length === 0) return;
  const db = await getDb();
  const assignments = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f] as string | number | null);
  await db.runAsync(`UPDATE items SET ${assignments} WHERE id = ?`, ...values, id);
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM items WHERE id = ?`, id);
}

export async function countItems(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) as n FROM items`);
  return row?.n ?? 0;
}

// ----- Settings (key/value) -----

export interface Settings {
  notificationsEnabled: boolean;
  leadTimeDays: number;
  hasReviewed: boolean; // OS review prompt shown once (US-7)
}

const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true,
  leadTimeDays: 2,
  hasReviewed: false,
};

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings`,
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    notificationsEnabled: map.has('notificationsEnabled')
      ? map.get('notificationsEnabled') === 'true'
      : DEFAULT_SETTINGS.notificationsEnabled,
    leadTimeDays: map.has('leadTimeDays')
      ? Number(map.get('leadTimeDays'))
      : DEFAULT_SETTINGS.leadTimeDays,
    hasReviewed: map.get('hasReviewed') === 'true',
  };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  for (const [key, value] of Object.entries(patch)) {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      String(value),
    );
  }
}
