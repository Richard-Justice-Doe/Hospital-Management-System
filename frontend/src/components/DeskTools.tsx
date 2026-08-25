import { useMemo, useState } from 'react';
import ItIssueDialog from './ItIssueDialog';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { useDesk } from '../context/DeskContext';
import { useStaffAccess } from '../hooks/useStaffAccess';
import { visitBalance } from '../workflow/billing';
import { PAGE_DASHBOARD_DEPARTMENT } from '../workflow/dashboard';
import { canAccessPage, homeDashboardPage } from '../workflow/permissions';
import { STAGE_LABELS, type CareState } from '../workflow/types';
import PageDateBox from './PageDateBox';
import { locatePatients, todaysOpenVisits } from '../workflow/deskUi';

function usePatientOpenPath() {
  const access = useStaffAccess();
  return (patientId: string) =>
    canAccessPage(access, 'reception') ? `/care/reception/visit?patient=${patientId}` : `/care/chart?patient=${patientId}`;
}

function waitingAtDesk(state: CareState, page: ReturnType<typeof homeDashboardPage>) {
  const open = todaysOpenVisits(state);
  if (page === 'reception' || page === 'admin') return open;
  if (page === 'nursing' || page === 'triage') return open.filter((visit) => visit.stage === 'CHECKED_IN');
  if (page === 'doctor') return open.filter((visit) => visit.stage === 'VITALS_DONE' || visit.stage === 'WITH_DOCTOR');
  if (page === 'billing' || page === 'collections') {
    return open.filter((visit) => visit.stage === 'READY_TO_BILL' || visitBalance(visit) > 0);
  }
  const department = PAGE_DASHBOARD_DEPARTMENT[page];
  if (department) {
    return open.filter((visit) => visit.orders.some((order) => order.department === department && order.status === 'ORDERED'));
  }
  return open;
}

export function DeskChrome() {
  const desk = useDesk();
  const { undoLast, canUndo, offline, resetDemo } = useCare();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <PageDateBox />
        <select value={desk.lang} onChange={(e) => desk.setLang(e.target.value as 'en' | 'tw' | 'gaa')} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="en">English</option>
          <option value="tw">Twi</option>
          <option value="gaa">Ga</option>
        </select>
        <button type="button" onClick={() => desk.setHugeType(!desk.hugeType)} className={`rounded-lg border border-slate-300 px-2 py-1.5 text-sm ${desk.hugeType ? 'border-clinic-600 bg-clinic-600 text-white' : 'bg-white hover:bg-slate-50'}`}>
          {desk.t('huge')}
        </button>
        <button type="button" onClick={() => desk.setVoiceOn(!desk.voiceOn)} className={`rounded-lg border border-slate-300 px-2 py-1.5 text-sm ${desk.voiceOn ? 'border-clinic-600 bg-clinic-600 text-white' : 'bg-white hover:bg-slate-50'}`}>
          {desk.t('voice')}
        </button>
        <button type="button" onClick={() => desk.setTraining(!desk.training)} className={`rounded-lg border px-2 py-1.5 text-sm ${desk.training ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
          {desk.t('train')}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {offline && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">{desk.t('offline')}</span>}
        <button type="button" disabled={!canUndo} onClick={() => undoLast()} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40">
          {desk.t('undo')}
        </button>
        {desk.training && (
          <button type="button" onClick={() => resetDemo()} className="rounded-lg bg-amber-100 px-2 py-1.5 text-xs font-semibold text-amber-900">
            Reset dummy patients
          </button>
        )}
      </div>
    </div>
  );
}

export function DeskActionBar() {
  const { user } = useAuth();
  const { state } = useCare();
  const desk = useDesk();
  const access = useStaffAccess();
  const navigate = useNavigate();
  const openPath = usePatientOpenPath();
  const reception = canAccessPage(access, 'reception');
  const page = homeDashboardPage({ role: user?.role ?? 'RECEPTIONIST', department: user?.department });
  const [query, setQuery] = useState('');
  const [itOpen, setItOpen] = useState(false);
  const hits = query.trim() ? locatePatients(state, query) : [];
  const waiting = useMemo(() => waitingAtDesk(state, page).slice(0, 6), [state, page]);

  function openPatient(patientId: string, billLater = false) {
    setQuery('');
    if (reception && billLater) {
      navigate(`/care/reception/visit?mode=bill&patient=${patientId}`);
      return;
    }
    navigate(openPath(patientId));
  }

  function callWaiting() {
    const visit = waiting[0];
    const person = visit ? state.patients.find((item) => item.id === visit.patientId) : undefined;
    if (!visit || !person) return;
    desk.callNext(`${person.firstName} ${person.lastName}`, `${person.hospitalNo} · ${STAGE_LABELS[visit.stage]}`);
  }

  return (
    <div className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={desk.t('find')}
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-clinic-500 focus:ring-2 focus:ring-clinic-100"
        />
        <button
          type="button"
          onClick={callWaiting}
          disabled={waiting.length === 0}
          className="rounded-lg bg-clinic-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Call next ({waiting.length})
        </button>
        {reception && (
          <button
            type="button"
            onClick={() => navigate('/care/reception/patients?new=1')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-clinic-50"
          >
            New folder
          </button>
        )}
        <button
          type="button"
          onClick={() => setItOpen(true)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-clinic-50"
        >
          IT issue
        </button>
      </div>
      {itOpen && <ItIssueDialog onClose={() => setItOpen(false)} />}

      {query.trim() ? (
        <ul className="mt-2 divide-y rounded-lg border">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No folder matches that name or number.</li>
          ) : (
            hits.map(({ patient, place }) => (
              <li key={patient.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {patient.firstName} {patient.lastName}
                    <span className="ml-2 font-mono text-xs text-clinic-700">{patient.hospitalNo}</span>
                  </p>
                  <p className="text-xs text-slate-500">{place}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openPatient(patient.id)} className="rounded-lg bg-clinic-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Open
                  </button>
                  {reception && (
                    <button type="button" onClick={() => openPatient(patient.id, true)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">
                      Bill later
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      ) : waiting.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {waiting.map((visit) => {
            const person = state.patients.find((item) => item.id === visit.patientId);
            if (!person) return null;
            return (
              <button
                key={visit.id}
                type="button"
                onClick={() => openPatient(person.id)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-clinic-400 hover:bg-clinic-50"
              >
                {person.firstName} {person.lastName}
                <span className="ml-1 text-slate-400">{STAGE_LABELS[visit.stage]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CallNextButton() {
  const { state } = useCare();
  const desk = useDesk();
  const next = todaysOpenVisits(state)[0];
  const person = state.patients.find((item) => item.id === next?.patientId);
  if (!next || !person) return null;
  return (
    <button
      type="button"
      onClick={() => desk.callNext(`${person.firstName} ${person.lastName}`, next.reason)}
      className="rounded-xl bg-clinic-600 px-4 py-2 text-sm font-semibold text-white"
    >
      {desk.t('callNext')}
    </button>
  );
}

export function CallNextOverlay() {
  const desk = useDesk();
  if (!desk.calling) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-clinic-900/80 p-4" onClick={desk.clearCall}>
      <div className="w-full max-w-lg rounded-xl bg-white p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-clinic-700">Next patient</p>
        <p className="mt-3 text-4xl font-semibold text-slate-900">{desk.calling.name}</p>
        <p className="mt-3 text-lg text-slate-600">{desk.calling.place}</p>
        <button type="button" onClick={desk.clearCall} className="mt-6 rounded-lg bg-clinic-600 px-6 py-2.5 text-sm font-semibold text-white">
          OK
        </button>
      </div>
    </div>
  );
}
