import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { USE_SERVER, setStaffPasswordRequest } from '../lib/server';
import { DEPARTMENT_LABELS } from '../workflow/catalog';
import { appendAudit } from '../workflow/his';
import {
  ASSET_KIND_LABEL,
  ASSET_STATUS_LABEL,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  itDeskStats,
  itStaff,
  systemHealth,
  ticketQueue,
  updateTicket,
  upsertAsset,
} from '../workflow/itDesk';
import { generateStaffPassword } from '../workflow/permissions';
import { staffUsername, upsertStaff } from '../workflow/store';
import type { AssetRecord, ItAssetKind, ItAssetStatus, ItTicketStatus } from '../workflow/types';
import { ROLE_LABELS } from '../workflow/types';
import AdminBackupsPage from './admin/AdminBackupsPage';
import { EmptyState, Field, SearchBox, btnPrimary, btnSecondary, inputClass } from './admin/adminUi';

const TABS = [
  { id: 'health', label: 'Health' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'assets', label: 'Assets' },
  { id: 'users', label: 'Users' },
  { id: 'audit', label: 'Audit' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function staffName(staff: { id: string; firstName: string; lastName: string }[], id?: string) {
  const person = staff.find((item) => item.id === id);
  return person ? `${person.firstName} ${person.lastName}` : id || '—';
}

export default function ItDeskPage() {
  const { user, refreshIfCurrent } = useAuth();
  const { state, updateCare } = useCare();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'tickets') as TabId;
  const [query, setQuery] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ItTicketStatus | ''>('');
  const stats = useMemo(() => itDeskStats(state), [state]);
  const health = useMemo(() => systemHealth(state), [state]);
  const tickets = useMemo(() => ticketQueue(state, statusFilter), [state, statusFilter]);
  const techs = useMemo(() => itStaff(state.staff), [state.staff]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.staff.filter((staff) => {
      if (!needle) return true;
      return `${staff.firstName} ${staff.lastName} ${staff.email} ${staffUsername(staff)} ${ROLE_LABELS[staff.role]}`
        .toLowerCase()
        .includes(needle);
    });
  }, [state.staff, query]);

  function setTab(next: TabId) {
    const copy = new URLSearchParams(params);
    copy.set('tab', next);
    setParams(copy);
  }

  function lockStaff(staff: (typeof state.staff)[number], lock: boolean) {
    updateCare((current) =>
      appendAudit(upsertStaff(current, { ...staff, isActive: !lock }), {
        staffId: user?.id ?? 'staff-it',
        action: lock ? 'staff_lock' : 'staff_unlock',
        entity: staffUsername(staff),
      }),
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-clinic-900">IT support</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tickets, devices, lockouts, and the audit trail. Roles and hospital setup stay with Admin.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
              tab === item.id ? 'bg-clinic-600 text-white' : 'border bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {item.label}
            {item.id === 'tickets' && stats.open + stats.inProgress > 0 ? ` (${stats.open + stats.inProgress})` : ''}
          </button>
        ))}
      </div>

      {tab === 'health' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HealthCard label="Last save" value={health.lastSavedAt ? new Date(health.lastSavedAt).toLocaleString() : 'Not yet this session'} hint="Hospital file on this desk" />
            <HealthCard label="Open tickets" value={String(health.openTickets)} hint={`${stats.resolved} resolved`} />
            <HealthCard label="Locked accounts" value={String(health.lockedAccounts.length)} hint={`${stats.active} active users`} />
            <HealthCard label="Failed sign-ins" value={String(health.failedLogins.length)} hint="This desk, recent attempts" />
          </div>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-medium text-slate-900">Locked accounts</h2>
            {health.lockedAccounts.length === 0 ? (
              <EmptyState title="Nobody is locked" hint="Use Users to lock an account if someone leaves a desk unlocked." />
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {health.lockedAccounts.map((staff) => (
                  <li key={staff.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span>
                      {staff.firstName} {staff.lastName} · {ROLE_LABELS[staff.role]}
                    </span>
                    <button type="button" className={btnSecondary} onClick={() => lockStaff(staff, false)}>
                      Unlock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-medium text-slate-900">Failed sign-ins</h2>
            {health.failedLogins.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No failed sign-ins recorded on this desk.</p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">When</th>
                    <th>Login used</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {health.failedLogins.slice(0, 15).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-2">{new Date(row.at).toLocaleString()}</td>
                      <td className="font-mono text-xs">{row.login}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <AdminBackupsPage />
        </div>
      )}

      {tab === 'tickets' && (
        <section className="rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium text-slate-900">Ticket queue</h2>
            <select className={`${inputClass} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ItTicketStatus | '')}>
              <option value="">All statuses</option>
              {(Object.keys(TICKET_STATUS_LABEL) as ItTicketStatus[]).map((key) => (
                <option key={key} value={key}>
                  {TICKET_STATUS_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
          {tickets.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No tickets in this filter" hint="Staff send issues from the IT issue button on every desk." />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Ticket</th>
                    <th>From</th>
                    <th>Priority</th>
                    <th>Assign</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-t align-top">
                      <td className="py-2">
                        <p className="font-medium">{ticket.title}</p>
                        <p className="text-xs text-slate-500">
                          {TICKET_CATEGORY_LABEL[ticket.category]}
                          {ticket.location ? ` · ${ticket.location}` : ''}
                        </p>
                        {ticket.detail && <p className="mt-1 text-xs text-slate-600">{ticket.detail}</p>}
                      </td>
                      <td className="text-xs">{staffName(state.staff, ticket.openedByStaffId)}</td>
                      <td>{TICKET_PRIORITY_LABEL[ticket.priority]}</td>
                      <td>
                        <select
                          className={`${inputClass} min-w-[8rem]`}
                          value={ticket.assignedToStaffId ?? ''}
                          onChange={(e) =>
                            updateCare((current) =>
                              updateTicket(current, ticket.id, { assignedToStaffId: e.target.value }, user?.id ?? 'staff-it'),
                            )
                          }
                        >
                          <option value="">Unassigned</option>
                          {techs.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.firstName} {person.lastName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className={`${inputClass} min-w-[8rem]`}
                          value={ticket.status}
                          onChange={(e) =>
                            updateCare((current) =>
                              updateTicket(current, ticket.id, { status: e.target.value as ItTicketStatus }, user?.id ?? 'staff-it'),
                            )
                          }
                        >
                          {(Object.keys(TICKET_STATUS_LABEL) as ItTicketStatus[]).map((key) => (
                            <option key={key} value={key}>
                              {TICKET_STATUS_LABEL[key]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'assets' && <AssetsPanel />}

      {tab === 'users' && (
        <section className="rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-medium text-slate-900">Users</h2>
              <p className="text-xs text-slate-500">Lock, unlock, or issue a password. Admin still owns roles.</p>
            </div>
            <SearchBox value={query} onChange={setQuery} placeholder="Search a staff account" />
          </div>
          {issued && (
            <p className="mt-3 rounded-lg bg-clinic-50 px-3 py-2 text-sm text-clinic-900">
              Give this password once: <span className="font-mono font-semibold">{issued}</span>
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Sign-in</th>
                  <th>Role</th>
                  <th>Desk</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((staff) => (
                  <tr key={staff.id} className="border-t">
                    <td className="py-2 font-medium">
                      {staff.firstName} {staff.lastName}
                    </td>
                    <td className="font-mono text-xs">
                      {staffUsername(staff)}
                      <span className="block text-slate-500">{staff.email}</span>
                    </td>
                    <td>{ROLE_LABELS[staff.role]}</td>
                    <td>{staff.department ? DEPARTMENT_LABELS[staff.department] : '—'}</td>
                    <td>{staff.isActive ? 'Active' : 'Locked'}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {staff.id !== 'staff-admin' && (
                          <button type="button" className={btnSecondary} onClick={() => lockStaff(staff, staff.isActive)}>
                            {staff.isActive ? 'Lock' : 'Unlock'}
                          </button>
                        )}
                        <button
                          type="button"
                          className={btnPrimary}
                          onClick={() => {
                            const password = generateStaffPassword();
                            const next = { ...staff, password };
                            updateCare((current) =>
                              appendAudit(upsertStaff(current, next), {
                                staffId: user?.id ?? 'staff-it',
                                action: 'staff_password_reset',
                                entity: staffUsername(staff),
                              }),
                            );
                            if (USE_SERVER) void setStaffPasswordRequest(staff.id, password).catch(() => undefined);
                            refreshIfCurrent?.(next);
                            setIssued(password);
                          }}
                        >
                          New password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-medium text-slate-900">Incident audit</h2>
          <p className="mt-1 text-sm text-slate-500">Read only. IT cannot change clinical notes or bills from this desk.</p>
          {(state.auditLog ?? []).length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No audit rows yet" hint="Locks, tickets, backups, and clinical saves will appear here." />
            </div>
          ) : (
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1">When</th>
                  <th>Action</th>
                  <th>Who</th>
                  <th>What</th>
                </tr>
              </thead>
              <tbody>
                {(state.auditLog ?? []).slice(0, 80).map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="py-1">{new Date(event.at).toLocaleString()}</td>
                    <td>{event.action}</td>
                    <td>{staffName(state.staff, event.staffId)}</td>
                    <td>{event.entity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

function HealthCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-clinic-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

function AssetsPanel() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const empty: AssetRecord = {
    id: '',
    name: '',
    location: '',
    kind: 'PC',
    status: 'IN_USE',
    serial: '',
    licenseKey: '',
    assignedStaffId: '',
    nextMaintenance: '',
  };
  const [form, setForm] = useState<AssetRecord>(empty);

  function save(e: FormEvent) {
    e.preventDefault();
    updateCare((current) => upsertAsset(current, form, user?.id ?? 'staff-it'));
    setForm(empty);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-medium text-slate-900">Hospital devices and licenses</h2>
        {state.assets.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No assets yet" hint="Add a PC, printer, phone, or license on the right." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Item</th>
                  <th>Kind</th>
                  <th>Where / who</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.assets.map((asset) => (
                  <tr key={asset.id} className="border-t">
                    <td className="py-2">
                      <p className="font-medium">{asset.name}</p>
                      <p className="font-mono text-xs text-slate-500">{asset.serial || asset.licenseKey || '—'}</p>
                    </td>
                    <td>{ASSET_KIND_LABEL[asset.kind ?? 'OTHER']}</td>
                    <td>
                      {asset.location}
                      {asset.assignedStaffId ? ` · ${staffName(state.staff, asset.assignedStaffId)}` : ''}
                    </td>
                    <td>{ASSET_STATUS_LABEL[asset.status ?? 'IN_USE']}</td>
                    <td>
                      <button type="button" className="text-sm font-medium text-clinic-700 hover:underline" onClick={() => setForm(asset)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <form onSubmit={save} className="space-y-3 rounded-xl border bg-white p-5">
        <h3 className="font-medium text-slate-900">{form.id ? 'Edit asset' : 'Add asset'}</h3>
        <Field label="Name">
          <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Kind">
          <select className={inputClass} value={form.kind ?? 'PC'} onChange={(e) => setForm({ ...form, kind: e.target.value as ItAssetKind })}>
            {(Object.keys(ASSET_KIND_LABEL) as ItAssetKind[]).map((key) => (
              <option key={key} value={key}>
                {ASSET_KIND_LABEL[key]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Room or desk">
          <input required className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
        <Field label="Assigned staff">
          <select className={inputClass} value={form.assignedStaffId ?? ''} onChange={(e) => setForm({ ...form, assignedStaffId: e.target.value })}>
            <option value="">Room only</option>
            {state.staff.filter((staff) => staff.isActive).map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.firstName} {staff.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Serial / license">
          <input
            className={inputClass}
            value={form.kind === 'LICENSE' ? (form.licenseKey ?? '') : (form.serial ?? '')}
            onChange={(e) =>
              setForm(form.kind === 'LICENSE' ? { ...form, licenseKey: e.target.value } : { ...form, serial: e.target.value })
            }
          />
        </Field>
        <Field label="Status">
          <select className={inputClass} value={form.status ?? 'IN_USE'} onChange={(e) => setForm({ ...form, status: e.target.value as ItAssetStatus })}>
            {(Object.keys(ASSET_STATUS_LABEL) as ItAssetStatus[]).map((key) => (
              <option key={key} value={key}>
                {ASSET_STATUS_LABEL[key]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={btnPrimary}>
            {form.id ? 'Save asset' : 'Add asset'}
          </button>
          {form.id && (
            <button type="button" className={btnSecondary} onClick={() => setForm(empty)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
