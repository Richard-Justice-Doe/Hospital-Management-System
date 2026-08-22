import { useMemo, useState } from 'react';
import { useCare } from '../../context/CareContext';
import { DEPARTMENT_LABELS } from '../../workflow/catalog';
import { ROLE_LABELS, type Department, type PageKey, type StaffAccount, type StaffRole } from '../../workflow/types';
import { btnDanger, btnPrimary, btnSecondary, EmptyState, Field, inputClass, SearchBox } from './adminUi';
import { effectivePages, GRANTABLE_PAGES, PAGE_LABELS, pagesFromChecks, roleDefaultPages } from '../../workflow/permissions';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  role: 'RECEPTIONIST' as StaffRole,
  department: '' as Department | '',
  inChargeOf: '' as Department | '',
};

type StaffFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function AdminStaffPage() {
  const { state, addStaff, saveStaff, removeStaff } = useCare();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StaffFilter>('ALL');
  const [form, setForm] = useState(emptyForm);
  const [pages, setPages] = useState<PageKey[]>(roleDefaultPages('RECEPTIONIST').filter((page) => page !== 'admin'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.staff.filter((staff) => {
      if (filter === 'ACTIVE' && !staff.isActive) return false;
      if (filter === 'INACTIVE' && staff.isActive) return false;
      if (!needle) return true;
      const hay = `${staff.firstName} ${staff.lastName} ${staff.email} ${ROLE_LABELS[staff.role]} ${staff.inChargeOf ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [state.staff, query, filter]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setPages(roleDefaultPages('RECEPTIONIST').filter((page) => page !== 'admin'));
    setShowForm(true);
    setShowPassword(true);
    setError(null);
    setMessage(null);
  }

  function openEdit(staff: StaffAccount) {
    setEditingId(staff.id);
    setForm({
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      phone: staff.phone ?? '',
      password: '',
      role: staff.role,
      department: staff.department ?? '',
      inChargeOf: staff.inChargeOf ?? '',
    });
    setPages(effectivePages({ role: staff.role, extra: staff.permissions?.extra, hidden: staff.permissions?.hidden }).filter((page) => page !== 'admin'));
    setShowForm(true);
    setShowPassword(false);
    setError(null);
    setMessage(null);
  }

  function handleSave() {
    setError(null);
    const email = form.email.trim().toLowerCase();
    if (!form.firstName.trim() || !form.lastName.trim() || !email) {
      setError('Fill in name, email, and role.');
      return;
    }
    if (!editingId && !form.password) {
      setError('Set a password for the new account.');
      return;
    }
    const taken = state.staff.some((staff) => staff.email === email && staff.id !== editingId);
    if (taken) {
      setError('That email already has an account.');
      return;
    }
    const checked = pagesFromChecks(form.role, pages);
    const payload = {
      ...form,
      email,
      phone: form.phone.trim() || undefined,
      department: form.department || undefined,
      inChargeOf: form.inChargeOf ? form.department || form.inChargeOf : undefined,
      permissions: checked.extra.length || checked.hidden.length ? checked : undefined,
    };
    if (editingId) {
      const current = state.staff.find((staff) => staff.id === editingId);
      if (!current) return;
      saveStaff({ ...current, ...payload, password: form.password || current.password }, form.password || undefined);
      setMessage(`Updated ${form.firstName} ${form.lastName}.`);
    } else {
      addStaff(payload);
      setMessage(`Added ${form.firstName} ${form.lastName}. They can sign in now.`);
    }
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-medium text-slate-900">Staff accounts</h2>
          </div>
          <button type="button" onClick={openAdd} className={btnPrimary}>
            Add staff
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, or role" />
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
        </div>

        {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No matching staff" hint="Try another search, or add a new account." />
          </div>
        ) : (
          <ul className="mt-4 divide-y">
            {rows.map((staff) => (
              <li key={staff.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {staff.firstName} {staff.lastName}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                        staff.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {staff.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    {ROLE_LABELS[staff.role]}
                    {staff.department ? ` · ${DEPARTMENT_LABELS[staff.department]}` : ''}
                    {staff.inChargeOf ? ` · In-charge of ${DEPARTMENT_LABELS[staff.inChargeOf]}` : ''}
                    {(staff.permissions?.extra?.length || staff.permissions?.hidden?.length) ? ' · Custom pages' : ''}
                  </p>
                  <p className="text-xs text-slate-500">{staff.email}{staff.phone ? ` · ${staff.phone}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openEdit(staff)} className={btnSecondary}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => saveStaff({ ...staff, isActive: !staff.isActive })}
                    className={btnSecondary}
                  >
                    {staff.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  {staff.id !== 'staff-admin' &&
                    (pendingDelete === staff.id ? (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            removeStaff(staff.id);
                            setPendingDelete(null);
                            setMessage(`Removed ${staff.firstName} ${staff.lastName}.`);
                          }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
                        >
                          Confirm delete
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {showForm && (
        <section className="h-fit rounded-xl border bg-white p-5">
          <h2 className="font-medium text-slate-900">{editingId ? 'Edit staff' : 'New staff member'}</h2>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Field label="First name">
              <input required className={inputClass} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="Last name">
              <input required className={inputClass} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
            <Field label="Email">
              <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone" hint="Used for shift SMS.">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="024 111 0101" />
            </Field>
            <Field label="Role">
              <select
                className={inputClass}
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as StaffRole;
                  setForm({ ...form, role });
                  setPages(roleDefaultPages(role).filter((page) => page !== 'admin'));
                }}
              >
                {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
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
                onChange={(e) => setForm({ ...form, department: e.target.value as Department | '' })}
              >
                <option value="">No department</option>
                {(Object.keys(DEPARTMENT_LABELS) as Department[]).map((dept) => (
                  <option key={dept} value={dept}>
                    {DEPARTMENT_LABELS[dept]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="In-charge">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form.inChargeOf)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      inChargeOf: e.target.checked ? form.department || 'RECORDS' : '',
                    })
                  }
                />
                In-charge of this department only
              </label>
            </Field>
            <Field label="Pages" hint="Role defaults are ticked. Untick to hide a page, or tick extra pages. Admin setup is only for the Admin role.">
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {GRANTABLE_PAGES.map((page) => (
                  <label key={page} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={pages.includes(page)}
                      onChange={(e) =>
                        setPages((current) =>
                          e.target.checked ? [...current, page] : current.filter((item) => item !== page),
                        )
                      }
                    />
                    {PAGE_LABELS[page]}
                  </label>
                ))}
                <label className="mt-1 flex items-center gap-2 rounded bg-slate-50 px-1 py-1 text-sm text-slate-500">
                  <input type="checkbox" checked={form.role === 'ADMIN'} disabled />
                  Admin
                </label>
              </div>
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
              </div>
            </Field>
            <div className="flex gap-2 pt-1">
              <button type="submit" className={btnPrimary}>
                {editingId ? 'Save changes' : 'Add staff'}
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
  );
}
