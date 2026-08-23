import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCare } from '../../context/CareContext';
import { DEPARTMENT_LABELS } from '../../workflow/catalog';
import { appendAudit } from '../../workflow/his';
import {
  GRANTABLE_PAGES,
  PAGE_GROUPS,
  PAGE_LABELS,
  ROLE_BLURBS,
  effectivePages,
  generateStaffPassword,
  pageGrant,
  pagesFromChecks,
  roleDefaultPages,
  roleWorkPages,
} from '../../workflow/permissions';
import { staffUsername, usernameFromEmail } from '../../workflow/store';
import { ROLE_LABELS, type Department, type PageKey, type StaffAccount, type StaffRole } from '../../workflow/types';
import { btnDanger, btnPrimary, btnSecondary, EmptyState, Field, inputClass, SearchBox } from './adminUi';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  phone: '',
  password: '',
  role: 'RECEPTIONIST' as StaffRole,
  department: '' as Department | '',
  inChargeOf: '' as Department | '',
};

type StaffFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type View = 'users' | 'roles' | 'matrix';

const ROLES = Object.keys(ROLE_LABELS) as StaffRole[];
const DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as Department[];
const MATRIX_PAGES = GRANTABLE_PAGES.filter((page) => page !== 'dashboard' && page !== 'assistant');

export default function AdminStaffPage() {
  const { user, refreshIfCurrent } = useAuth();
  const { state, addStaff, saveStaff, removeStaff, updateCare } = useCare();
  const [view, setView] = useState<View>('users');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StaffFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<StaffRole | ''>('');
  const [deptFilter, setDeptFilter] = useState<Department | ''>('');
  const [form, setForm] = useState(emptyForm);
  const [pages, setPages] = useState<PageKey[]>(roleDefaultPages('RECEPTIONIST').filter((page) => page !== 'admin'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusPages, setFocusPages] = useState(false);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.staff.filter((staff) => {
      if (filter === 'ACTIVE' && !staff.isActive) return false;
      if (filter === 'INACTIVE' && staff.isActive) return false;
      if (roleFilter && staff.role !== roleFilter) return false;
      if (deptFilter && staff.department !== deptFilter) return false;
      if (!needle) return true;
      const hay = `${staff.firstName} ${staff.lastName} ${staff.email} ${staffUsername(staff)} ${ROLE_LABELS[staff.role]} ${staff.department ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [state.staff, query, filter, roleFilter, deptFilter]);

  function applyRolePages(role: StaffRole, department?: Department | '') {
    setPages(roleDefaultPages(role, department || undefined, state.rolePageGrants?.[role]).filter((page) => page !== 'admin'));
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    applyRolePages('RECEPTIONIST');
    setShowForm(true);
    setShowPassword(true);
    setIssuedPassword(null);
    setError(null);
    setMessage(null);
    setFocusPages(false);
    setView('users');
  }

  function openEdit(staff: StaffAccount, jumpToPages = false) {
    setEditingId(staff.id);
    setForm({
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      username: staffUsername(staff),
      phone: staff.phone ?? '',
      password: '',
      role: staff.role,
      department: staff.department ?? '',
      inChargeOf: staff.inChargeOf ?? '',
    });
    setPages(
      effectivePages({
        role: staff.role,
        department: staff.department,
        extra: staff.permissions?.extra,
        hidden: staff.permissions?.hidden,
        rolePages: state.rolePageGrants?.[staff.role],
      }).filter((page) => page !== 'admin'),
    );
    setShowForm(true);
    setShowPassword(false);
    setIssuedPassword(null);
    setError(null);
    setMessage(null);
    setFocusPages(jumpToPages);
    setView('users');
  }

  useEffect(() => {
    if (!showForm || !focusPages) return;
    document.getElementById('staff-page-permissions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm, focusPages, editingId]);

  function handleSave() {
    setError(null);
    const email = form.email.trim().toLowerCase();
    const username = (form.username.trim() || usernameFromEmail(email)).toLowerCase();
    if (!form.firstName.trim() || !form.lastName.trim() || !email) {
      setError('Fill in name, email, username, and role.');
      return;
    }
    if (!editingId && !form.password) {
      setError('Set or generate a password for the new account.');
      return;
    }
    const taken = state.staff.some((staff) => staff.email === email && staff.id !== editingId);
    if (taken) {
      setError('That email already has an account.');
      return;
    }
    const usernameTaken = state.staff.some((staff) => staffUsername(staff) === username && staff.id !== editingId);
    if (usernameTaken) {
      setError('That username is already used.');
      return;
    }
    const checked = pagesFromChecks(form.role, pages, form.department || undefined, state.rolePageGrants?.[form.role]);
    const payload = {
      ...form,
      email,
      username,
      phone: form.phone.trim() || undefined,
      department: form.department || undefined,
      inChargeOf: form.inChargeOf ? form.department || form.inChargeOf : undefined,
      permissions: { extra: checked.extra, hidden: checked.hidden },
    };
    const name = `${form.firstName} ${form.lastName}`.trim();
    if (editingId) {
      const current = state.staff.find((staff) => staff.id === editingId);
      if (!current) return;
      const saved = {
        ...current,
        ...payload,
        password: form.password || current.password,
        lastAccessReviewAt: new Date().toISOString(),
      };
      saveStaff(saved, form.password || undefined);
      refreshIfCurrent(saved);
      setMessage(`Updated ${name}. They will only see the pages you ticked.`);
    } else {
      addStaff(payload);
      setMessage(`Added ${name}. They will only see the pages you ticked.`);
    }
    if (form.password) setIssuedPassword(form.password);
    updateCare((next) =>
      appendAudit(next, {
        staffId: user?.id ?? 'staff-admin',
        action: editingId ? 'staff_update' : 'staff_create',
        entity: username,
        reason: `${ROLE_LABELS[form.role]}${form.department ? ` · ${DEPARTMENT_LABELS[form.department]}` : ''}`,
      }),
    );
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  }

  const counts = {
    all: state.staff.length,
    active: state.staff.filter((staff) => staff.isActive).length,
    custom: state.staff.filter((staff) => staff.permissions?.extra?.length || staff.permissions?.hidden?.length).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">User management</h2>
          <p className="mt-1 text-sm text-slate-500">
            {counts.active} active · {counts.all} accounts · {counts.custom} with custom pages
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['users', 'roles', 'matrix'] as View[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                view === item ? 'bg-clinic-600 text-white' : 'border bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item === 'users' ? 'Users' : item === 'roles' ? 'Roles' : 'Permissions'}
            </button>
          ))}
          <button type="button" onClick={openAdd} className={btnPrimary}>
            Add user
          </button>
        </div>
      </div>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {issuedPassword && (
        <div className="rounded-lg border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm">
          <p className="font-medium text-clinic-900">Give this password once, then they can change it.</p>
          <p className="mt-1 font-mono text-base font-semibold">{issuedPassword}</p>
        </div>
      )}

      {view === 'roles' && <RolesPanel staff={state.staff} onOpenRole={(role) => { setRoleFilter(role); setView('users'); }} />}
      {view === 'matrix' && <PermissionMatrix />}

      {view === 'users' && (
        <div className={`grid gap-6 ${showForm ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]' : ''}`}>
          <section className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={query} onChange={setQuery} placeholder="Search name, username, email, or role" />
              {(['ALL', 'ACTIVE', 'INACTIVE'] as StaffFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    filter === item ? 'bg-clinic-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item === 'ALL' ? 'All' : item === 'ACTIVE' ? 'Active' : 'Inactive'}
                </button>
              ))}
              <select className={`${inputClass} w-auto`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as StaffRole | '')}>
                <option value="">All roles</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <select className={`${inputClass} w-auto`} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as Department | '')}>
                <option value="">All departments</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {DEPARTMENT_LABELS[dept]}
                  </option>
                ))}
              </select>
            </div>

            {rows.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No matching users" hint="Try another search, or add a user." />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">User</th>
                      <th className="px-3 py-2 font-medium">Sign-in</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Desk</th>
                      <th className="px-3 py-2 font-medium">Pages</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((staff) => {
                      const granted = effectivePages({
                        role: staff.role,
                        department: staff.department,
                        extra: staff.permissions?.extra,
                        hidden: staff.permissions?.hidden,
                        rolePages: state.rolePageGrants?.[staff.role],
                      });
                      const custom = Boolean(staff.permissions?.extra?.length || staff.permissions?.hidden?.length);
                      return (
                        <tr key={staff.id} className="border-t">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">
                              {staff.firstName} {staff.lastName}
                            </p>
                            <p className="text-xs text-slate-500">{staff.phone ?? 'No phone'}</p>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {staffUsername(staff)}
                            <span className="mt-0.5 block text-slate-500">{staff.email}</span>
                          </td>
                          <td className="px-3 py-2">{ROLE_LABELS[staff.role]}</td>
                          <td className="px-3 py-2">
                            {staff.department ? DEPARTMENT_LABELS[staff.department] : '—'}
                            {staff.inChargeOf ? <span className="block text-xs text-clinic-700">In-charge</span> : null}
                          </td>
                          <td className="px-3 py-2">
                            {granted.length}
                            {custom ? <span className="ml-1 text-xs text-amber-700">custom</span> : <span className="ml-1 text-xs text-slate-400">role</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${staff.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {staff.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => openEdit(staff)} className={btnSecondary}>
                                Edit
                              </button>
                              <button type="button" onClick={() => openEdit(staff, true)} className={btnSecondary}>
                                Set pages
                              </button>
                              {staff.id !== 'staff-admin' && (
                                <button type="button" onClick={() => saveStaff({ ...staff, isActive: !staff.isActive })} className={btnSecondary}>
                                  {staff.isActive ? 'Lock' : 'Unlock'}
                                </button>
                              )}
                              {staff.id !== 'staff-admin' &&
                                (pendingDelete === staff.id ? (
                                  <span className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        removeStaff(staff.id);
                                        setPendingDelete(null);
                                        setMessage(`Removed ${staff.firstName} ${staff.lastName}.`);
                                      }}
                                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
                                    >
                                      Confirm
                                    </button>
                                    <button type="button" onClick={() => setPendingDelete(null)} className={btnSecondary}>
                                      Cancel
                                    </button>
                                  </span>
                                ) : (
                                  <button type="button" onClick={() => setPendingDelete(staff.id)} className={btnDanger}>
                                    Delete
                                  </button>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {showForm && (
            <section className="h-fit rounded-xl border bg-white p-5">
              <h3 className="font-medium text-slate-900">{editingId ? 'Edit user' : 'New user'}</h3>
              {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Identity</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name">
                    <input required className={inputClass} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  </Field>
                  <Field label="Last name">
                    <input required className={inputClass} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </Field>
                </div>
                <Field label="Phone">
                  <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="024 111 0101" />
                </Field>

                <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sign-in</p>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => {
                      const email = e.target.value;
                      const previous = usernameFromEmail(form.email);
                      const keepCustom = form.username.trim() && form.username.trim().toLowerCase() !== previous;
                      setForm({ ...form, email, username: keepCustom ? form.username : usernameFromEmail(email) });
                    }}
                  />
                </Field>
                <Field label="Username" hint="They can sign in with username or email.">
                  <input required className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </Field>
                <Field label="Password">
                  <div className="flex gap-2">
                    <input
                      required={!editingId}
                      type={showPassword ? 'text' : 'password'}
                      className={inputClass}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={editingId ? 'Leave blank to keep the current password' : ''}
                    />
                    <button type="button" className={btnSecondary} onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => {
                        const next = generateStaffPassword();
                        setForm((current) => ({ ...current, password: next }));
                        setShowPassword(true);
                      }}
                    >
                      Generate
                    </button>
                  </div>
                </Field>

                <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Role and desk</p>
                <Field label="Role" hint={ROLE_BLURBS[form.role]}>
                  <select
                    className={inputClass}
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value as StaffRole;
                      setForm({ ...form, role });
                      applyRolePages(role, form.department);
                    }}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Department">
                  <select
                    className={inputClass}
                    value={form.department}
                    onChange={(e) => {
                      const department = e.target.value as Department | '';
                      setForm({ ...form, department });
                    }}
                  >
                    <option value="">No department</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {DEPARTMENT_LABELS[dept]}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.inChargeOf)}
                    onChange={(e) => setForm({ ...form, inChargeOf: e.target.checked ? form.department || 'RECORDS' : '' })}
                  />
                  In-charge of this department (roster and unpaid bills only)
                </label>

                <p id="staff-page-permissions" className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  What they can see
                </p>
                <p className="text-xs text-slate-500">
                  Tick every page this person may open. Unticked pages stay hidden from their menu. Dashboard stays on for everyone.
                </p>
                <VisiblePagesPreview role={form.role} department={form.department || undefined} checked={pages} rolePages={state.rolePageGrants?.[form.role]} />
                <button type="button" className={`${btnSecondary} text-xs`} onClick={() => applyRolePages(form.role, form.department)}>
                  Reset to role defaults
                </button>
                <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {PAGE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-semibold text-slate-500">{group.label}</p>
                      <div className="mt-1 space-y-1">
                        {group.pages.map((page) => {
                          const grant = pageGrant(page, {
                            role: form.role,
                            department: form.department || undefined,
                            extra: pagesFromChecks(form.role, pages, form.department || undefined, state.rolePageGrants?.[form.role]).extra,
                            hidden: pagesFromChecks(form.role, pages, form.department || undefined, state.rolePageGrants?.[form.role]).hidden,
                            rolePages: state.rolePageGrants?.[form.role],
                          });
                          const checked = page === 'dashboard' || pages.includes(page);
                          return (
                            <label key={page} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={page === 'dashboard'}
                                  onChange={(e) =>
                                    setPages((current) =>
                                      e.target.checked ? [...current, page] : current.filter((item) => item !== page),
                                    )
                                  }
                                />
                                {PAGE_LABELS[page]}
                              </span>
                              <GrantBadge grant={grant} />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <label className="flex items-center justify-between gap-2 rounded bg-slate-50 px-1 py-1 text-sm text-slate-500">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={form.role === 'ADMIN'} disabled />
                      Admin setup
                    </span>
                    <GrantBadge grant={form.role === 'ADMIN' ? 'admin' : 'off'} />
                  </label>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" className={btnPrimary}>
                    {editingId ? 'Save user' : 'Create user'}
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function VisiblePagesPreview({
  role,
  department,
  checked,
  rolePages,
}: {
  role: StaffRole;
  department?: Department;
  checked: PageKey[];
  rolePages?: PageKey[];
}) {
  const saved = pagesFromChecks(role, checked, department, rolePages);
  const seen = effectivePages({ role, department, extra: saved.extra, hidden: saved.hidden, rolePages });
  return (
    <div className="rounded-lg border border-clinic-100 bg-clinic-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-clinic-800">They will see</p>
      <p className="mt-1 text-sm text-clinic-950">{seen.map((page) => PAGE_LABELS[page]).join(' · ')}</p>
    </div>
  );
}

function GrantBadge({ grant }: { grant: ReturnType<typeof pageGrant> }) {
  const label =
    grant === 'required'
      ? 'Required'
      : grant === 'default'
        ? 'Role'
        : grant === 'extra'
          ? 'Extra'
          : grant === 'hidden'
            ? 'Hidden'
            : grant === 'admin'
              ? 'Admin only'
              : 'Off';
  const cls =
    grant === 'required' || grant === 'admin'
      ? 'bg-slate-200 text-slate-700'
      : grant === 'default'
        ? 'bg-clinic-50 text-clinic-800'
        : grant === 'extra'
          ? 'bg-amber-50 text-amber-800'
          : grant === 'hidden'
            ? 'bg-red-50 text-red-700'
            : 'bg-slate-50 text-slate-400';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>{label}</span>;
}

function RolesPanel({ staff, onOpenRole }: { staff: StaffAccount[]; onOpenRole: (role: StaffRole) => void }) {
  const { state } = useCare();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ROLES.map((role) => {
        const people = staff.filter((item) => item.role === role);
        const pages = roleWorkPages(role, undefined, state.rolePageGrants?.[role]);
        return (
          <button
            key={role}
            type="button"
            onClick={() => onOpenRole(role)}
            className="rounded-xl border bg-white p-4 text-left hover:border-clinic-400 hover:bg-clinic-50"
          >
            <p className="font-semibold text-slate-900">{ROLE_LABELS[role]}</p>
            <p className="mt-1 text-sm text-slate-500">{ROLE_BLURBS[role]}</p>
            <p className="mt-3 text-xs text-slate-500">
              {people.length} user{people.length === 1 ? '' : 's'} · {pages.length} default pages
            </p>
            <p className="mt-2 text-xs text-clinic-800">{pages.map((page) => PAGE_LABELS[page]).join(' · ')}</p>
          </button>
        );
      })}
    </div>
  );
}

function PermissionMatrix() {
  const { state, updateCare } = useCare();

  function toggle(role: StaffRole, page: PageKey) {
    if (role === 'ADMIN' || page === 'dashboard') return;
    const current = new Set(roleWorkPages(role, undefined, state.rolePageGrants?.[role]));
    if (current.has(page)) current.delete(page);
    else current.add(page);
    const next = GRANTABLE_PAGES.filter((item) => current.has(item) || item === 'dashboard');
    updateCare((s) => ({
      ...s,
      rolePageGrants: { ...s.rolePageGrants, [role]: next },
    }));
  }

  return (
    <section className="overflow-x-auto rounded-xl border bg-white">
      <p className="border-b px-4 py-3 text-sm text-slate-600">
        Click a cell to allow or remove a page for that role. Admin keeps every page. To change one person only, open Users and choose Set pages.
      </p>
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="sticky left-0 bg-slate-50 px-3 py-2 font-medium">Role</th>
            {MATRIX_PAGES.map((page) => (
              <th key={page} className="px-2 py-2 font-medium">
                {PAGE_LABELS[page]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((role) => {
            const allowed = new Set(roleWorkPages(role, undefined, state.rolePageGrants?.[role]));
            return (
              <tr key={role} className="border-t">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-800">{ROLE_LABELS[role]}</td>
                {MATRIX_PAGES.map((page) => {
                  const on = role === 'ADMIN' || allowed.has(page);
                  const locked = role === 'ADMIN';
                  return (
                    <td key={page} className="px-2 py-2 text-center">
                      {locked ? (
                        <span className="font-semibold text-clinic-700">Yes</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle(role, page)}
                          className={`rounded px-2 py-1 font-semibold ${on ? 'text-clinic-700 hover:bg-clinic-50' : 'text-slate-300 hover:bg-slate-50 hover:text-slate-500'}`}
                          aria-pressed={on}
                        >
                          {on ? 'Yes' : '—'}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
