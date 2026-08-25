import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import PatientIdentity from '../components/PatientIdentity';
import { formatGhs } from '../workflow/catalog';
import { downloadAccountantClaimsExcel } from '../workflow/claimsExcel';
import { sendMessage, upsertClaim, verifyEligibility } from '../workflow/his';
import { insuranceLabel, visitMissingRequiredCc } from '../workflow/patientAdmin';
import {
  CLAIM_STATUS_LABEL,
  claimQueue,
  filterClaimQueue,
  type ClaimQueueRow,
  type ClaimsTab,
  visitClaimAmount,
} from '../workflow/supportDesks';
import { btnPrimary, btnSecondary, EmptyState, Field, inputClass } from './admin/adminUi';
import { DeskPage, PageHeader } from '../components/PageChrome';

const QUEUES: Array<{ id: ClaimsTab; label: string }> = [
  { id: 'nhis', label: 'NHIS / Ghana Card' },
  { id: 'private', label: 'Private insurance' },
  { id: 'denied', label: 'Denied / query' },
  { id: 'remittance', label: 'Remittance' },
];

function claimLabel(row: ClaimQueueRow): string {
  const name = row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : 'Unknown patient';
  const folder = row.patient?.hospitalNo ?? '';
  const claimNo = row.claim?.claimNo ?? 'No claim yet';
  const amount = formatGhs(row.claim?.amountGhs ?? visitClaimAmount(row.visit));
  const insurer = row.scheme === 'NHIS' ? 'NHIS' : row.patient?.insuranceProvider ?? 'Private';
  return `${name} · ${folder} · ${insurer} · ${claimNo} · ${amount}`;
}

export default function ClaimsDeskPage() {
  const { user } = useAuth();
  const { state, updateCare } = useCare();
  const [tab, setTab] = useState<ClaimsTab>('nhis');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [denial, setDenial] = useState('');
  const rows = useMemo(() => filterClaimQueue(claimQueue(state), tab, query), [state, tab, query]);
  const selected = rows.find((row) => row.visit.id === selectedId);
  const amount = selected ? selected.claim?.amountGhs ?? visitClaimAmount(selected.visit) : 0;
  const status = selected?.claim?.status ?? 'DRAFT';
  const missingCc = selected ? visitMissingRequiredCc(selected.patient, selected.visit) : false;

  function work(statusNext: 'ELIGIBLE' | 'SUBMITTED' | 'PAID' | 'DENIED') {
    if (!selected) return;
    if (statusNext === 'SUBMITTED' && visitMissingRequiredCc(selected.patient, selected.visit)) return;
    let nextState = state;
    updateCare((next) => {
      nextState = upsertClaim(next, {
        visitId: selected.visit.id,
        status: statusNext,
        denialReason: statusNext === 'DENIED' ? denial.trim() || 'Need more documentation' : undefined,
      });
      if (statusNext === 'SUBMITTED') {
        nextState = sendMessage(nextState, {
          fromId: user?.id ?? 'staff-claims',
          toRole: 'ACCOUNTANT',
          body: `Claims Excel is ready: ${selected.patient ? `${selected.patient.firstName} ${selected.patient.lastName}` : 'a claim'} · ${formatGhs(amount)}. Check it before NHIS / government remittance.`,
        });
      }
      if (statusNext === 'PAID') {
        nextState = sendMessage(nextState, {
          fromId: user?.id ?? 'staff-claims',
          toRole: 'ACCOUNTANT',
          body: `Remittance cash to receive: ${selected.patient ? `${selected.patient.firstName} ${selected.patient.lastName}` : 'a claim'} · ${formatGhs(amount)}. Record it in collections.`,
        });
      }
      return nextState;
    });
    if (statusNext === 'SUBMITTED') downloadAccountantClaimsExcel(nextState, selected.visit.id);
  }

  return (
    <DeskPage className="space-y-4">
      <PageHeader
        title="Claims desk"
        hint="Choose the queue, then pick the claim from the list. When you submit, an Excel file is prepared for the accountant. They check it before anything goes to NHIS or government for remittance."
      />

      <section className="desk-panel p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Claims queue">
            <select
              className={inputClass}
              value={tab}
              onChange={(e) => {
                setTab(e.target.value as ClaimsTab);
                setSelectedId('');
              }}
            >
              {QUEUES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search in this queue">
            <input
              className={inputClass}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedId('');
              }}
              placeholder="Name, folder, insurer, or claim number"
            />
          </Field>
        </div>
        <Field label="Claim">
          <select
            className={`${inputClass} mt-1`}
            size={Math.min(10, Math.max(4, rows.length + 1))}
            value={selected?.visit.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">{rows.length === 0 ? 'No claims in this list' : 'Choose a claim…'}</option>
            {rows.map((row) => (
              <option key={row.visit.id} value={row.visit.id}>
                {claimLabel(row)}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {rows.length} claim{rows.length === 1 ? '' : 's'} in {QUEUES.find((item) => item.id === tab)?.label}
          </p>
          <button type="button" className={btnSecondary} onClick={() => downloadAccountantClaimsExcel(state)}>
            Download all submitted as Excel for accountant
          </button>
        </div>
      </section>

      {!selected ? (
        <EmptyState title="No claim selected" hint="Pick a claim from the list above." />
      ) : (
        <section className="desk-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <PatientIdentity patient={selected.patient} />
              <p className="mt-1 text-sm text-slate-600">{insuranceLabel(selected.patient)}</p>
              <p className="text-xs text-slate-500">
                {selected.scheme === 'NHIS' ? 'NHIS / Ghana Card' : selected.patient?.insuranceProvider ?? 'Private'} ·{' '}
                {CLAIM_STATUS_LABEL[status]} · {formatGhs(amount)}
                {selected.visit.nhisCcCode ? ` · CC ${selected.visit.nhisCcCode}` : ''}
              </p>
              {missingCc ? (
                <p className="mt-1 text-xs font-semibold text-amber-800">CC code is required before this NHIS / Ghana Card claim can be submitted.</p>
              ) : null}
              {selected.claim?.eligibilityDetail ? <p className="mt-1 text-xs text-emerald-800">{selected.claim.eligibilityDetail}</p> : null}
              {selected.claim?.denialReason ? <p className="mt-1 text-xs text-red-700">{selected.claim.denialReason}</p> : null}
            </div>
            <p className="font-mono text-xs text-slate-500">{selected.claim?.claimNo ?? 'No claim yet'}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => work('ELIGIBLE')}>
              Check eligibility
            </button>
            <button type="button" className={btnPrimary} disabled={missingCc} onClick={() => work('SUBMITTED')}>
              Submit — Excel for accountant
            </button>
            <button type="button" className={btnSecondary} onClick={() => downloadAccountantClaimsExcel(state, selected.visit.id)}>
              Download accountant Excel
            </button>
            <button type="button" className={btnSecondary} onClick={() => work('PAID')}>
              Record remittance
            </button>
            <button type="button" className={btnSecondary} onClick={() => work('DENIED')}>
              Deny / query
            </button>
          </div>
          <input
            className={`${inputClass} mt-3`}
            value={denial}
            onChange={(e) => setDenial(e.target.value)}
            placeholder="Query reason (missing notes, codes, Ghana Card copy)"
          />
          {selected.patient ? <p className="mt-2 text-xs text-slate-500">{verifyEligibility(state, selected.patient.id).detail}</p> : null}
          <p className="sr-only">{user?.id}</p>
        </section>
      )}
    </DeskPage>
  );
}
