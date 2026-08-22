import { AuthError } from './api';
import type { CareState, PageKey, PatientRecord, StaffRole } from '../workflow/types';
import type { Department } from '../workflow/types';

export const USE_SERVER = import.meta.env.MODE !== 'test';

export interface AuthUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  department?: Department;
  inChargeOf?: Department;
  permissions?: { extra?: PageKey[]; hidden?: PageKey[] };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new AuthError(data.error ?? 'Request failed', res.status);
  }
  return data;
}

export function loginRequest(email: string, password: string) {
  return request<{
    status: 'ok';
    user: AuthUserDto;
  }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function logoutRequest() {
  return request('/api/auth/logout', { method: 'POST', body: '{}' });
}

export function meRequest() {
  return request<{ user: AuthUserDto }>('/api/auth/me');
}

export function getCare() {
  return request<{ version: number; state: CareState }>('/api/care');
}

export function putCare(state: CareState, version: number) {
  return fetch('/api/care', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, version }),
  });
}

export function setStaffPasswordRequest(staffId: string, password: string) {
  return request('/api/staff/password', { method: 'POST', body: JSON.stringify({ staffId, password }) });
}

export function resetPinRequest(patientId: string) {
  return request<{ pin: string }>(`/api/patients/${patientId}/pin`, { method: 'POST', body: '{}' });
}

export function portalLoginRequest(hospitalNo: string, pin: string) {
  return request<{
    patient: PatientRecord;
    state: { visits: CareState['visits']; appointments: CareState['appointments']; notifications: CareState['notifications'] };
  }>('/api/portal/login', { method: 'POST', body: JSON.stringify({ hospitalNo, pin }) });
}

export function portalMeRequest() {
  return request<{
    patient: PatientRecord;
    state: { visits: CareState['visits']; appointments: CareState['appointments']; notifications: CareState['notifications'] };
  }>('/api/portal/me');
}

export function portalLogoutRequest() {
  return request('/api/portal/logout', { method: 'POST', body: '{}' });
}

export function listBackupsRequest() {
  return request<{ backups: Array<{ id: string; created_at: string; reason: string }> }>('/api/backups');
}

export function createBackupRequest(reason: string) {
  return request<{ backups: Array<{ id: string; created_at: string; reason: string }> }>('/api/backups', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function downloadBackupRequest(id: string) {
  return request<{ id: string; createdAt: string; reason: string; state: CareState }>(`/api/backups/${id}`);
}

export function restoreBackupRequest(id: string) {
  return request<{ version: number; state: CareState }>(`/api/backups/${id}/restore`, { method: 'POST', body: '{}' });
}

export function exportClaimRequest(visitId: string) {
  return request<unknown>(`/api/claims/${visitId}/export`);
}

export function runRemindersRequest() {
  return request<{ sent: number; emailed: number }>('/api/reminders/run', { method: 'POST', body: '{}' });
}

export function listOutboundRequest() {
  return request<{
    messages: Array<{
      id: string;
      channel: string;
      to_addr: string;
      subject?: string;
      body: string;
      status: string;
      created_at: string;
    }>;
  }>('/api/outbound');
}
