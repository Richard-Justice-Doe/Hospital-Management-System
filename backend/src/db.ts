import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import initSqlJs, { type Database } from 'sql.js';
import type { CareState } from '../../frontend/src/workflow/types.ts';

const require = createRequire(import.meta.url);
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const dbPath = join(dataDir, 'hospital.sqlite');

let db: Database;

function persist() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(dbPath, Buffer.from(db.export()));
}

function run(sql: string, params: unknown[] = []) {
  db.run(sql, params as never[]);
  persist();
}

function one<T>(sql: string, params: unknown[] = []): T | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params as never[]);
  const row = stmt.step() ? (stmt.getAsObject() as T) : undefined;
  stmt.free();
  return row;
}

function many<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as never[]);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export async function openDb() {
  mkdirSync(dataDir, { recursive: true });
  const wasmDir = dirname(require.resolve('sql.js/dist/sql-wasm.js'));
  const SQL = await initSqlJs({
    locateFile: (file: string) => join(wasmDir, file),
  });
  db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS hospital (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staff_auth (
      staff_id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      totp_secret TEXT NOT NULL,
      totp_confirmed INTEGER NOT NULL DEFAULT 0,
      mfa_required INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS patient_pins (
      patient_id TEXT PRIMARY KEY,
      pin_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      state_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_guard (
      key TEXT PRIMARY KEY,
      fails INTEGER NOT NULL,
      window_start INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbound (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      to_addr TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  persist();
}

export function getSetting(key: string, fallback: string) {
  return one<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export function loadHospital(): { version: number; state: CareState } | null {
  const row = one<{ version: number; state_json: string }>('SELECT version, state_json FROM hospital WHERE id = 1');
  if (!row) return null;
  return { version: Number(row.version), state: JSON.parse(row.state_json) as CareState };
}

export function saveHospital(state: CareState, version: number) {
  run(
    'INSERT OR REPLACE INTO hospital (id, version, state_json, updated_at) VALUES (1, ?, ?, ?)',
    [version, JSON.stringify(state), new Date().toISOString()],
  );
}

export function addBackup(id: string, reason: string, state: CareState) {
  run('INSERT INTO backups (id, created_at, reason, state_json) VALUES (?, ?, ?, ?)', [
    id,
    new Date().toISOString(),
    reason,
    JSON.stringify(state),
  ]);
  const extra = many<{ id: string }>('SELECT id FROM backups ORDER BY created_at DESC LIMIT -1 OFFSET 30');
  for (const row of extra) run('DELETE FROM backups WHERE id = ?', [row.id]);
}

export function listBackups() {
  return many<{ id: string; created_at: string; reason: string }>(
    'SELECT id, created_at, reason FROM backups ORDER BY created_at DESC',
  );
}

export function getBackup(id: string) {
  return one<{ id: string; created_at: string; reason: string; state_json: string }>(
    'SELECT id, created_at, reason, state_json FROM backups WHERE id = ?',
    [id],
  );
}

export type StaffAuth = {
  staff_id: string;
  email: string;
  password_hash: string;
  totp_secret: string;
  totp_confirmed: number;
  mfa_required: number;
};

export function getAuthByEmail(email: string) {
  return one<StaffAuth>('SELECT * FROM staff_auth WHERE email = ?', [email.trim().toLowerCase()]);
}

export function getAuthByStaffId(staffId: string) {
  return one<StaffAuth>('SELECT * FROM staff_auth WHERE staff_id = ?', [staffId]);
}

export function upsertStaffAuth(row: StaffAuth) {
  run(
    `INSERT OR REPLACE INTO staff_auth (staff_id, email, password_hash, totp_secret, totp_confirmed, mfa_required)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.staff_id, row.email.trim().toLowerCase(), row.password_hash, row.totp_secret, row.totp_confirmed, row.mfa_required],
  );
}

export function setPinHash(patientId: string, pinHash: string) {
  run('INSERT OR REPLACE INTO patient_pins (patient_id, pin_hash) VALUES (?, ?)', [patientId, pinHash]);
}

export function getPinHash(patientId: string) {
  return one<{ pin_hash: string }>('SELECT pin_hash FROM patient_pins WHERE patient_id = ?', [patientId])?.pin_hash;
}

export function loginGuard(key: string) {
  return one<{ fails: number; window_start: number }>('SELECT fails, window_start FROM login_guard WHERE key = ?', [key]);
}

export function setLoginGuard(key: string, fails: number, windowStart: number) {
  run('INSERT OR REPLACE INTO login_guard (key, fails, window_start) VALUES (?, ?, ?)', [key, fails, windowStart]);
}

export function clearLoginGuard(key: string) {
  run('DELETE FROM login_guard WHERE key = ?', [key]);
}

export function addOutbound(row: {
  id: string;
  channel: 'email' | 'sms';
  to_addr: string;
  subject?: string;
  body: string;
  status: string;
}) {
  run(
    'INSERT INTO outbound (id, channel, to_addr, subject, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [row.id, row.channel, row.to_addr, row.subject ?? '', row.body, row.status, new Date().toISOString()],
  );
  const extra = many<{ id: string }>('SELECT id FROM outbound ORDER BY created_at DESC LIMIT -1 OFFSET 200');
  for (const item of extra) run('DELETE FROM outbound WHERE id = ?', [item.id]);
}

export function listOutbound() {
  return many<{
    id: string;
    channel: string;
    to_addr: string;
    subject: string;
    body: string;
    status: string;
    created_at: string;
  }>('SELECT id, channel, to_addr, subject, body, status, created_at FROM outbound ORDER BY created_at DESC LIMIT 50');
}
