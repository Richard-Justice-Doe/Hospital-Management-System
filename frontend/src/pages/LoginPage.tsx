import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { APP_HOME, useAuth } from '../context/AuthContext';
import PageDateBox from '../components/PageDateBox';
import HospitalMark from '../components/HospitalMark';
import { AuthError } from '../lib/api';

const DEPARTMENTS = [
  { name: 'Reception', detail: 'Folders and new visits', photo: '/hospital/hospital-reception.png' },
  { name: 'OPD', detail: 'Consultations', photo: '/hospital/hospital-opd.png' },
  { name: 'Nursing', detail: 'Vitals and procedures', photo: '/hospital/hospital-ward.png' },
  { name: 'Laboratory', detail: 'Tests and results', photo: '/hospital/hospital-lab.png' },
  { name: 'Pharmacy', detail: 'Dispensing', photo: '/hospital/hospital-pharmacy.png' },
  { name: 'Imaging', detail: 'X-ray, ultrasound, ECG', photo: '/hospital/hospital-imaging.png?v=2' },
  { name: 'Ward', detail: 'Admission and beds', photo: '/hospital/hospital-ward.png' },
  { name: 'Theatre', detail: 'Minor operations', photo: '/hospital/hospital-theatre.png?v=2' },
  { name: 'Maternity', detail: 'ANC and delivery', photo: '/hospital/hospital-maternity.png' },
  { name: 'Eye / ENT / Dental', detail: 'Specialist clinics', photo: '/hospital/hospital-opd.png' },
  { name: 'Physiotherapy', detail: 'Rehab sessions', photo: '/hospital/hospital-physio.png?v=2' },
  { name: 'Accounts', detail: 'Cashier and collections', photo: '/hospital/hospital-reception.png' },
  { name: 'Claims', detail: 'NHIS, Ghana Card, private insurance', photo: '/hospital/hospital-reception.png' },
  { name: 'Stores / procurement', detail: 'Stock, issues, and purchase orders', photo: '/hospital/hospital-pharmacy.png' },
  { name: 'IT support', detail: 'Tickets, devices, lockouts, and audit', photo: '/hospital/hospital-reception.png' },
];

export default function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && user) {
    return <Navigate to={APP_HOME} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Invalid username, email, or password');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="relative z-10 bg-clinic-900/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <HospitalMark />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-clinic-100">Municipal hospital</p>
              <h1 className="text-lg font-bold leading-tight sm:text-xl">Clinic Management System</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="rounded-lg bg-white px-2 py-1">
              <PageDateBox />
            </div>
            <span className="rounded-full bg-red-600 px-3 py-1.5 font-medium">Emergency 24 hours</span>
            <Link className="rounded-full bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20" to="/portal">
              Patient portal
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate h-[22rem] overflow-hidden sm:h-[28rem]">
        <img
          src="/hospital/hospital-hero.png"
          alt="Hospital entrance"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-clinic-900/85 via-clinic-900/55 to-clinic-900/25" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-10">
          <p className="text-sm font-medium uppercase tracking-wide text-clinic-100">Hospital interface</p>
          <h2 className="mt-1 max-w-xl text-3xl font-semibold text-white sm:text-4xl">Care from reception to the ward</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-clinic-50 sm:text-base">
            Sign in to the staff desk for your department. OPD 7:00–17:00 · Pharmacy 8:00–20:00 · Laboratory 7:30–16:00 ·
            NHIS and cash accepted.
          </p>
        </div>
      </section>

      <main className="relative mx-auto -mt-10 grid max-w-6xl gap-8 px-4 pb-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)] lg:items-start">
        <section>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {DEPARTMENTS.map((dept) => (
              <li key={dept.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img src={dept.photo} alt={dept.name} className="h-36 w-full object-cover" />
                <div className="p-3">
                  <p className="font-medium text-clinic-900">{dept.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{dept.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg lg:sticky lg:top-6">
          <img src="/hospital/hospital-reception.png" alt="" className="h-36 w-full object-cover" />
          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-clinic-700">Staff desk</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Staff sign-in</h2>
            <p className="mt-1 text-sm text-slate-500">Use your username or hospital email, then the password.</p>

            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="mt-5 space-y-4"
            >
              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Username or email
                </label>
                <input
                  id="email"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="admin or admin@clinic.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-clinic-600 py-2.5 font-medium text-white disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm">
              <Link className="text-clinic-700 hover:underline" to="/portal">
                Patient portal
              </Link>
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
