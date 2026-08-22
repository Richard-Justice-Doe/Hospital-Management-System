import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createSeedState, ensureDemoStaff } from '../../frontend/src/workflow/seed.ts';
import { buildClaimPack, hydrateHis, markNoticeDelivered, pendingShiftMessages, sendDueReminders } from '../../frontend/src/workflow/his.ts';
import type { CareState } from '../../frontend/src/workflow/types.ts';
import {
  addBackup,
  addOutbound,
  clearLoginGuard,
  getAuthByEmail,
  getAuthByStaffId,
  getBackup,
  getPinHash,
  getSetting,
  listBackups,
  listOutbound,
  loadHospital,
  loginGuard,
  openDb,
  saveHospital,
  setLoginGuard,
  setPinHash,
  setSetting,
  upsertStaffAuth,
} from './db.ts';

const PORT = Number(process.env.PORT ?? 4000);
const SESSION_MS = 15 * 60 * 1000;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_FAILS = 5;
const COOKIE = 'cms_session';
const PORTAL_COOKIE = 'cms_portal';

type Token = { sub: string; typ: 'staff' | 'portal'; email?: string };

function jwtSecret() {
  let secret = getSetting('jwt_secret', '');
  if (!secret) {
    secret = bcrypt.hashSync(`cms-${Date.now()}-${Math.random()}`, 8);
    setSetting('jwt_secret', secret);
  }
  return secret;
}

function sign(payload: Token, ms = SESSION_MS) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: Math.floor(ms / 1000) });
}

function readToken(token: string | undefined): Token | null {
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret()) as Token;
  } catch {
    return null;
  }
}

function publicState(state: CareState): CareState {
  return {
    ...state,
    staff: ensureDemoStaff(state.staff).map((s) => ({ ...s, password: '' })),
    patients: state.patients.map((p) => ({ ...p, portalPin: undefined })),
  };
}

function captureSecrets(prev: CareState | null, next: CareState) {
  const known = new Set(prev?.patients.map((p) => p.id) ?? []);
  for (const patient of next.patients) {
    if (patient.portalPin && (!getPinHash(patient.id) || !known.has(patient.id))) {
      setPinHash(patient.id, bcrypt.hashSync(patient.portalPin, 10));
    }
  }
  for (const staff of next.staff) {
    const existing = getAuthByStaffId(staff.id) ?? getAuthByEmail(staff.email);
    if (staff.password && staff.password !== '••••••••') {
      upsertStaffAuth({
        staff_id: staff.id,
        email: staff.email,
        password_hash: bcrypt.hashSync(staff.password, 10),
        totp_secret: existing?.totp_secret || '',
        totp_confirmed: 0,
        mfa_required: 0,
      });
    } else if (!existing) {
      upsertStaffAuth({
        staff_id: staff.id,
        email: staff.email,
        password_hash: bcrypt.hashSync(`pending-${staff.id}`, 10),
        totp_secret: '',
        totp_confirmed: 0,
        mfa_required: 0,
      });
    } else if (existing.email !== staff.email.trim().toLowerCase() || existing.staff_id !== staff.id) {
      upsertStaffAuth({ ...existing, staff_id: staff.id, email: staff.email, mfa_required: 0 });
    }
  }
  return {
    ...next,
    staff: next.staff.map((s) => ({ ...s, password: '' })),
    patients: next.patients.map((p) => ({ ...p, portalPin: undefined })),
  };
}

function seedAuth(state: CareState) {
  for (const staff of state.staff) {
    if (getAuthByStaffId(staff.id)) continue;
    upsertStaffAuth({
      staff_id: staff.id,
      email: staff.email,
      password_hash: bcrypt.hashSync(staff.password || 'ChangeMe1!', 10),
      totp_secret: '',
      totp_confirmed: 0,
      mfa_required: 0,
    });
  }
  for (const patient of state.patients) {
    if (getPinHash(patient.id)) continue;
    setPinHash(patient.id, bcrypt.hashSync(patient.portalPin || String(100000 + Math.floor(Math.random() * 900000)), 10));
  }
}

function snapshot(reason: string, state: CareState) {
  addBackup(`bak-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, reason, state);
}

async function mail(to: string | undefined, subject: string, text: string) {
  if (!to) return { sent: false as const, logged: false as const, reason: 'No address' };
  try {
    if (!process.env.SMTP_HOST) {
      addOutbound({
        id: `out-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        channel: 'email',
        to_addr: to,
        subject,
        body: text,
        status: 'logged',
      });
      return { sent: false as const, logged: true as const, reason: 'SMTP not configured' };
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === '1',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'clinic@localhost',
      to,
      subject,
      text,
    });
    addOutbound({
      id: `out-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      channel: 'email',
      to_addr: to,
      subject,
      body: text,
      status: 'sent',
    });
    return { sent: true as const, logged: true as const };
  } catch {
    addOutbound({
      id: `out-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      channel: 'email',
      to_addr: to,
      subject,
      body: text,
      status: 'failed',
    });
    return { sent: false as const, logged: true as const };
  }
}

function e164Phone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `+233${digits.slice(1)}`;
  if (digits.startsWith('233')) return `+${digits}`;
  if (phone.trim().startsWith('+')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

async function sms(to: string | undefined, text: string) {
  if (!to) return { sent: false as const, logged: false as const, reason: 'No phone' };
  const dest = e164Phone(to);
  try {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (sid && token && from && dest) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: dest, Body: text }).toString(),
    });
    const status = res.ok ? 'sent' : `failed:${res.status}`;
    addOutbound({
      id: `out-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      channel: 'sms',
      to_addr: dest,
      body: text,
      status,
    });
    return { sent: res.ok, logged: true as const };
  }
  if (process.env.SMS_URL && dest) {
    const res = await fetch(process.env.SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.SMS_TOKEN ? { Authorization: `Bearer ${process.env.SMS_TOKEN}` } : {}) },
      body: JSON.stringify({ to: dest, from: process.env.SMS_FROM ?? 'ClinicCMS', body: text }),
    });
    addOutbound({
      id: `out-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      channel: 'sms',
      to_addr: dest,
      body: text,
      status: res.ok ? 'sent' : `failed:${res.status}`,
    });
    return { sent: res.ok, logged: true as const };
  }
  addOutbound({
    id: `out-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    channel: 'sms',
    to_addr: dest || to,
    body: text,
    status: 'logged',
  });
  return { sent: false as const, logged: true as const, reason: 'SMS gateway not configured' };
  } catch {
    addOutbound({
      id: `out-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      channel: 'sms',
      to_addr: dest || to,
      body: text,
      status: 'failed',
    });
    return { sent: false as const, logged: true as const };
  }
}

function guardKey(req: Request) {
  return req.ip ?? req.socket.remoteAddress ?? 'local';
}

function checkLock(req: Request) {
  const row = loginGuard(guardKey(req));
  if (!row) return false;
  if (Date.now() - Number(row.window_start) > LOGIN_WINDOW_MS) {
    clearLoginGuard(guardKey(req));
    return false;
  }
  return Number(row.fails) >= LOGIN_MAX_FAILS;
}

function failLogin(req: Request) {
  const now = Date.now();
  const row = loginGuard(guardKey(req));
  const windowStart = row && now - Number(row.window_start) <= LOGIN_WINDOW_MS ? Number(row.window_start) : now;
  const fails = (row && windowStart === Number(row.window_start) ? Number(row.fails) : 0) + 1;
  setLoginGuard(guardKey(req), fails, windowStart);
  return fails >= LOGIN_MAX_FAILS;
}

function requireStaff(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req.cookies?.[COOKIE]);
  if (!token || token.typ !== 'staff') {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  const hospital = loadHospital();
  const staff = hospital?.state.staff.find((s) => s.id === token.sub && s.isActive);
  if (!staff) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  res.locals.staff = staff;
  res.locals.user = {
    id: staff.id,
    email: staff.email,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    department: staff.department,
    inChargeOf: staff.inChargeOf,
    permissions: staff.permissions,
  };
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireStaff(req, res, () => {
    if (res.locals.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }
    next();
  });
}

async function main() {
  await openDb();
  let loaded = loadHospital();
  if (!loaded) {
    const seeded = hydrateHis(createSeedState());
    seedAuth(seeded);
    const stored = captureSecrets(null, seeded);
    saveHospital(stored, 1);
    snapshot('initial', stored);
    loaded = { version: 1, state: stored };
  } else {
    seedAuth({
      ...loaded.state,
      staff: ensureDemoStaff(loaded.state.staff).map((s) => {
        const seed = createSeedState().staff.find((row) => row.id === s.id);
        return { ...s, password: s.password || seed?.password || '' };
      }),
    });
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '25mb' }));
  app.use(cookieParser() as unknown as express.RequestHandler);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, backups: listBackups().length, https: Boolean(process.env.SSL_KEY) });
  });

  app.post('/api/auth/login', async (req, res) => {
    if (checkLock(req)) {
      res.status(429).json({ error: 'Too many failed sign-ins. Wait one minute.' });
      return;
    }
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const auth = getAuthByEmail(email);
    const hospital = loadHospital();
    const staff = hospital?.state.staff.find((s) => s.email === email && s.isActive);
    if (!auth || !staff || !bcrypt.compareSync(password, auth.password_hash)) {
      const locked = failLogin(req);
      res.status(401).json({ error: locked ? 'Too many failed sign-ins. Wait one minute.' : 'Invalid email or password' });
      return;
    }
    clearLoginGuard(guardKey(req));
    res.cookie(COOKIE, sign({ sub: staff.id, typ: 'staff', email: staff.email }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MS,
    });
    res.json({ status: 'ok', user: resUser(staff) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE);
    res.clearCookie(PORTAL_COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireStaff, (req, res) => {
    res.cookie(COOKIE, sign({ sub: res.locals.user.id, typ: 'staff', email: res.locals.user.email }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MS,
    });
    res.json({ user: res.locals.user });
  });

  app.get('/api/care', requireStaff, (_req, res) => {
    const hospital = loadHospital();
    if (!hospital) {
      res.status(500).json({ error: 'Hospital file missing' });
      return;
    }
    res.json({ version: hospital.version, state: publicState(hydrateHis(hospital.state)) });
  });

  app.put('/api/care', requireStaff, async (req, res) => {
    const hospital = loadHospital();
    if (!hospital) {
      res.status(500).json({ error: 'Hospital file missing' });
      return;
    }
    const incoming = req.body?.state as CareState | undefined;
    const version = Number(req.body?.version ?? 0);
    if (!incoming?.patients || !incoming.visits || !incoming.staff) {
      res.status(400).json({ error: 'Invalid hospital file' });
      return;
    }
    if (version !== hospital.version) {
      res.status(409).json({ error: 'Record changed on another desk', version: hospital.version, state: publicState(hospital.state) });
      return;
    }
    const stored = await deliverShiftNotices(captureSecrets(hospital.state, hydrateHis({ ...hospital.state, ...incoming })));
    const nextVersion = hospital.version + 1;
    saveHospital(stored, nextVersion);
    if (nextVersion % 25 === 0) snapshot('auto', stored);
    res.json({ version: nextVersion, state: publicState(stored) });
  });

  app.post('/api/staff/password', requireAdmin, (req, res) => {
    const staffId = String(req.body?.staffId ?? '');
    const password = String(req.body?.password ?? '');
    const hospital = loadHospital();
    const staff = hospital?.state.staff.find((s) => s.id === staffId);
    if (!staff || password.length < 8) {
      res.status(400).json({ error: 'Staff and a password of 8 or more characters are required.' });
      return;
    }
    const existing = getAuthByStaffId(staffId);
    upsertStaffAuth({
      staff_id: staff.id,
      email: staff.email,
      password_hash: bcrypt.hashSync(password, 10),
      totp_secret: existing?.totp_secret || '',
      totp_confirmed: 0,
      mfa_required: 0,
    });
    res.json({ ok: true });
  });

  app.post('/api/patients/:id/pin', requireStaff, (req, res) => {
    const pin = String(100000 + Math.floor(Math.random() * 900000));
    setPinHash(req.params.id, bcrypt.hashSync(pin, 10));
    res.json({ pin });
  });

  app.post('/api/portal/login', (req, res) => {
    const hospitalNo = String(req.body?.hospitalNo ?? '').replace(/\s/g, '').toLowerCase();
    const pin = String(req.body?.pin ?? '').trim();
    const hospital = loadHospital();
    const patient = hospital?.state.patients.find(
      (p) => p.hospitalNo.replace(/\s/g, '').toLowerCase() === hospitalNo && !p.mergedIntoId,
    );
    const hash = patient ? getPinHash(patient.id) : undefined;
    if (!patient || !hash || !bcrypt.compareSync(pin, hash)) {
      res.status(401).json({ error: 'Invalid folder number or PIN.' });
      return;
    }
    res.cookie(PORTAL_COOKIE, sign({ sub: patient.id, typ: 'portal' }, 60 * 60_000), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60_000,
    });
    res.json({ patient: { ...patient, portalPin: undefined }, state: portalView(hospital!.state, patient.id) });
  });

  app.get('/api/portal/me', (req, res) => {
    const token = readToken(req.cookies?.[PORTAL_COOKIE]);
    const hospital = loadHospital();
    const patient = token?.typ === 'portal' ? hospital?.state.patients.find((p) => p.id === token.sub) : undefined;
    if (!patient || !hospital) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }
    res.json({ patient: { ...patient, portalPin: undefined }, state: portalView(hospital.state, patient.id) });
  });

  app.post('/api/portal/logout', (_req, res) => {
    res.clearCookie(PORTAL_COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/backups', requireAdmin, (_req, res) => {
    res.json({ backups: listBackups() });
  });

  app.post('/api/backups', requireAdmin, (req, res) => {
    const hospital = loadHospital();
    if (!hospital) {
      res.status(500).json({ error: 'Hospital file missing' });
      return;
    }
    snapshot(String(req.body?.reason ?? 'manual'), hospital.state);
    res.json({ backups: listBackups() });
  });

  app.get('/api/backups/:id', requireAdmin, (req, res) => {
    const row = getBackup(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    res.json({ id: row.id, createdAt: row.created_at, reason: row.reason, state: JSON.parse(row.state_json) });
  });

  app.post('/api/backups/:id/restore', requireAdmin, (req, res) => {
    const row = getBackup(req.params.id);
    const hospital = loadHospital();
    if (!row || !hospital) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    snapshot('before-restore', hospital.state);
    const restored = JSON.parse(row.state_json) as CareState;
    const version = hospital.version + 1;
    saveHospital(restored, version);
    res.json({ version, state: publicState(restored) });
  });

  app.get('/api/outbound', requireStaff, (_req, res) => {
    res.json({ messages: listOutbound() });
  });

  app.get('/api/claims/:visitId/export', requireStaff, (req, res) => {
    const hospital = loadHospital();
    if (!hospital) {
      res.status(500).json({ error: 'Hospital file missing' });
      return;
    }
    res.json(buildClaimPack(hospital.state, req.params.visitId));
  });

  app.post('/api/reminders/run', requireStaff, async (_req, res) => {
    const result = await runReminders();
    res.json(result);
  });

  setInterval(() => {
    void runReminders();
  }, 60_000);
  setInterval(() => {
    const hospital = loadHospital();
    if (hospital) snapshot('scheduled', hospital.state);
  }, 6 * 60 * 60_000);

  const server =
    process.env.SSL_KEY && process.env.SSL_CERT
      ? createHttpsServer(
          { key: readFileSync(process.env.SSL_KEY), cert: readFileSync(process.env.SSL_CERT) },
          app,
        )
      : app;

  server.listen(PORT, () => {
    console.log(`Hospital API http://127.0.0.1:${PORT} (${process.env.SSL_KEY ? 'HTTPS' : 'HTTP'})`);
  });
}

function resUser(staff: CareState['staff'][number]) {
  return {
    id: staff.id,
    email: staff.email,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    department: staff.department,
    inChargeOf: staff.inChargeOf,
    permissions: staff.permissions,
  };
}

function portalView(state: CareState, patientId: string) {
  return {
    visits: state.visits.filter((v) => v.patientId === patientId),
    appointments: state.appointments.filter((a) => a.patientId === patientId),
    notifications: state.notifications.filter((n) => n.patientId === patientId),
  };
}

async function deliverShiftNotices(state: CareState): Promise<CareState> {
  let next = state;
  for (const notice of pendingShiftMessages(next)) {
    const staff = next.staff.find((s) => s.id === notice.staffId);
    const email = await mail(staff?.email, notice.title, notice.body);
    const text = await sms(staff?.phone, notice.body);
    next = markNoticeDelivered(next, notice.id, {
      emailSent: Boolean(email.sent || email.logged),
      smsSent: Boolean(text.sent || text.logged),
    });
  }
  return next;
}

async function runReminders() {
  const hospital = loadHospital();
  if (!hospital) return { sent: 0 };
  const before = new Set(hospital.state.appointments.filter((a) => a.reminderSent).map((a) => a.id));
  let next = sendDueReminders(hospital.state);
  const fresh = next.appointments.filter((a) => a.reminderSent && !before.has(a.id));
  let mailed = 0;
  for (const apt of fresh) {
    const patient = next.patients.find((p) => p.id === apt.patientId);
    const result = await mail(
      patient?.email,
      'Appointment reminder',
      `Please come for ${apt.reason} on ${new Date(apt.startsAt).toLocaleString()}.`,
    );
    if (result.sent || result.logged) mailed += 1;
  }
  const shiftPending = pendingShiftMessages(next).length;
  next = await deliverShiftNotices(next);
  if (fresh.length || shiftPending) {
    saveHospital(next, hospital.version + 1);
  }
  return { sent: fresh.length, emailed: mailed, shifts: shiftPending };
}

void main();
