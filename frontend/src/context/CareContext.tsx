import {
  addCharges,
  allocatePatientFolder,
  applyVisitBilling,
  averageWaitMinutes,
  checkInExisting,
  completeOrder,
  completeOrders,
  copayersForPatient,
  createStaff,
  deleteCopayer,
  deletePatient,
  deleteStaff,
  loadCareState,
  newPortalPin,
  openPatientFolder,
  payBill,
  planCare,
  recordVitals,
  registerPatient,
  removeCharge,
  resetCareState,
  saveCareState,
  sendToDoctor,
  setServiceEnabled,
  setServicePrice,
  staffActivity,
  upsertCopayer,
  upsertPatient,
  upsertStaff,
  visitsToday,
  type PatientAdminInput,
} from '../workflow/store';
import { canReceivePayment, canRemoveBill } from '../workflow/billing';
import { afterLabResults, afterPharmacyDispense, afterPlanCare, hydrateHis, purgePatientHis } from '../workflow/his';
import type {
  CareState,
  ClinicId,
  CopayerRecord,
  CopayerRelationship,
  PatientRecord,
  StaffAccount,
  StaffRole,
  VisitDisposition,
  VisitStage,
  LabLine,
  Department,
} from '../workflow/types';
import type { VitalsInput } from '../workflow/vitals';
import { useAuth } from './AuthContext';
import { getCare, putCare, resetPinRequest, setStaffPasswordRequest, USE_SERVER } from '../lib/server';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface CareContextValue {
  state: CareState;
  syncError: string | null;
  registerNewPatient: (input: PatientAdminInput & { reason: string; clinic?: ClinicId; copayerId?: string }) => string;
  createFolder: (input: PatientAdminInput) => { ok: true; hospitalNo: string; portalPin?: string } | { ok: false; error: string };
  openFolder: (patientId: string, staffId: string) => void;
  checkIn: (patientId: string, reason: string, staffId: string, clinic?: ClinicId, copayerId?: string) => void;
  saveCopayer: (input: {
    id?: string;
    patientId: string;
    firstName: string;
    lastName: string;
    relationship: CopayerRelationship;
    phone: string;
    address?: string;
    isPrimary?: boolean;
  }) => void;
  removeCopayer: (copayerId: string) => void;
  patientCopayers: (patientId: string) => CopayerRecord[];
  saveVitals: (visitId: string, vitals: VitalsInput, staffId: string) => void;
  routeToDoctor: (visitId: string) => void;
  planVisit: (
    visitId: string,
    input: {
      diagnosis: string;
      prescription: string;
      notes: string;
      disposition: VisitDisposition;
      referredTo?: string;
      serviceIds: string[];
      soapSubjective?: string;
      soapObjective?: string;
      soapAssessment?: string;
      soapPlan?: string;
      taxPercent?: number;
    },
  ) => void;
  finishOrder: (visitId: string, orderId: string, result?: string, labLines?: LabLine[]) => void;
  finishOrders: (
    visitId: string,
    updates: Array<{ orderId: string; result?: string; labLines?: LabLine[] }>,
  ) => void;
  addToBill: (visitId: string, serviceIds: string[]) => void;
  removeFromBill: (visitId: string, orderId: string) => void;
  decideBilling: (
    visitId: string,
    input: { billable: boolean; serviceIds: string[]; waivedReason?: string; staffId: string },
  ) => void;
  collectPayment: (visitId: string, staffId: string) => void;
  toggleService: (serviceId: string, enabled: boolean) => void;
  updatePrice: (serviceId: string, priceGhs: number) => void;
  savePatient: (patient: PatientRecord) => void;
  removePatient: (patientId: string) => void;
  addStaff: (input: {
    email: string;
    username?: string;
    firstName: string;
    lastName: string;
    role: StaffRole;
    password: string;
    inChargeOf?: Department;
    department?: Department;
    phone?: string;
    permissions?: StaffAccount['permissions'];
  }) => void;
  saveStaff: (staff: StaffAccount, password?: string) => void;
  removeStaff: (staffId: string) => void;
  resetPortalPin: (patientId: string) => Promise<string>;
  applyServerState: (state: CareState, version: number) => void;
  resetDemo: () => void;
  updateCare: (updater: (state: CareState) => CareState) => void;
  undoLast: () => boolean;
  canUndo: boolean;
  offline: boolean;
  visitsByStage: (stage: VisitStage) => CareState['visits'];
  todayVisits: CareState['visits'];
  avgWaitMinutes: number | null;
  activity: { staffId: string; name: string; actions: number }[];
}

const CareContext = createContext<CareContextValue | null>(null);

export function CareProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CareState>(() => loadCareState());
  const [syncError, setSyncError] = useState<string | null>(null);
  const [offline, setOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [canUndo, setCanUndo] = useState(false);
  const { user } = useAuth();
  const versionRef = useRef(0);
  const undoRef = useRef<Array<{ at: number; prev: CareState }>>([]);
  const skipUndo = useRef(false);

  const applyServerState = useCallback((next: CareState, version: number) => {
    versionRef.current = version;
    setState(hydrateHis(next));
  }, []);

  const commit = useCallback(
    (next: CareState) => {
      if (!skipUndo.current) {
        undoRef.current = [...undoRef.current, { at: Date.now(), prev: state }].slice(-10);
        setCanUndo(true);
      }
      skipUndo.current = false;
      const stamped = { ...next, lastSavedAt: new Date().toISOString() };
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOffline(true);
        setState(saveCareState(stamped));
        setSyncError('Offline — saved on this desk.');
        return;
      }
      setOffline(false);
      if (!USE_SERVER) {
        setState(saveCareState(stamped));
        return;
      }
      setState(stamped);
      void putCare(stamped, versionRef.current).then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { version?: number; state?: CareState; error?: string };
        if (res.status === 409 && body.state && body.version) {
          setSyncError('Another desk saved first. Showing the shared hospital file.');
          applyServerState(body.state, body.version);
          return;
        }
        if (!res.ok) {
          setSyncError(body.error ?? 'Could not save to the hospital server.');
          return;
        }
        setSyncError(null);
        if (body.state && body.version) applyServerState(body.state, body.version);
      });
    },
    [applyServerState, state],
  );

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!USE_SERVER || !user) return;
    void getCare()
      .then((res) => applyServerState(res.state, res.version))
      .catch(() => setSyncError('Hospital server is not reachable. Start npm run dev from the project folder.'));
    const timer = window.setInterval(() => {
      void getCare()
        .then((res) => {
          if (res.version !== versionRef.current) applyServerState(res.state, res.version);
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [user, applyServerState]);

  const value = useMemo<CareContextValue>(
    () => ({
      state,
      syncError,
      applyServerState,
      registerNewPatient: (input) => {
        const next = registerPatient(state, input);
        commit(next);
        return next.patients[0]?.hospitalNo ?? '';
      },
      createFolder: (input) => {
        const result = allocatePatientFolder(state, input);
        if ('error' in result) return { ok: false, error: result.error };
        const pin = result.state.patients[0]?.portalPin;
        commit(result.state);
        return { ok: true, hospitalNo: result.hospitalNo ?? '', portalPin: pin };
      },
      openFolder: (patientId, staffId) => commit(openPatientFolder(state, patientId, staffId)),
      checkIn: (patientId, reason, staffId, clinic, copayerId) =>
        commit(checkInExisting(state, patientId, reason, staffId, clinic, copayerId)),
      saveCopayer: (input) => commit(upsertCopayer(state, input)),
      removeCopayer: (copayerId) => commit(deleteCopayer(state, copayerId)),
      patientCopayers: (patientId) => copayersForPatient(state.copayers, patientId),
      saveVitals: (visitId, vitals, staffId) => commit(recordVitals(state, visitId, vitals, staffId)),
      routeToDoctor: (visitId) => commit(sendToDoctor(state, visitId)),
      planVisit: (visitId, input) =>
        commit(afterPlanCare(planCare(state, visitId, input), visitId, user?.id ?? 'staff-doctor', input.prescription)),
      finishOrder: (visitId, orderId, result, labLines) => {
        const staffId = user?.id ?? 'staff-pharmacy';
        const afterWork = afterLabResults(
          completeOrder(state, visitId, orderId, result, labLines),
          visitId,
          [{ orderId, result, labLines }],
          staffId,
        );
        commit(afterPharmacyDispense(afterWork, visitId, orderId, staffId));
      },
      finishOrders: (visitId, updates) =>
        commit(afterLabResults(completeOrders(state, visitId, updates), visitId, updates, user?.id ?? 'staff-lab')),
      addToBill: (visitId, serviceIds) => commit(addCharges(state, visitId, serviceIds, 'DONE')),
      removeFromBill: (visitId, orderId) => {
        const staff = state.staff.find((item) => item.id === user?.id) ?? user;
        const order = state.visits.find((visit) => visit.id === visitId)?.orders.find((item) => item.id === orderId);
        if (!order || !canRemoveBill(staff, order.department)) return;
        commit(removeCharge(state, visitId, orderId));
      },
      decideBilling: (visitId, input) => commit(applyVisitBilling(state, visitId, input)),
      collectPayment: (visitId, staffId) => {
        if (!canReceivePayment(user?.role)) return;
        commit(payBill(state, visitId, staffId));
      },
      toggleService: (serviceId, enabled) => commit(setServiceEnabled(state, serviceId, enabled)),
      updatePrice: (serviceId, priceGhs) => commit(setServicePrice(state, serviceId, priceGhs)),
      savePatient: (patient) => commit(upsertPatient(state, patient)),
      removePatient: (patientId) => commit(purgePatientHis(deletePatient(state, patientId), patientId)),
      addStaff: (input) => {
        const next = createStaff(state, input);
        commit(next);
        const created = next.staff.find((s) => s.email === input.email.trim().toLowerCase());
        if (USE_SERVER && created) void setStaffPasswordRequest(created.id, input.password).catch(() => undefined);
      },
      saveStaff: (staff, password) => {
        commit(upsertStaff(state, { ...staff, password: password || staff.password || '' }));
        if (USE_SERVER && password) void setStaffPasswordRequest(staff.id, password).catch(() => undefined);
      },
      removeStaff: (staffId) => commit(deleteStaff(state, staffId)),
      resetPortalPin: async (patientId) => {
        if (USE_SERVER) {
          const res = await resetPinRequest(patientId);
          return res.pin;
        }
        const pin = newPortalPin();
        commit({
          ...state,
          patients: state.patients.map((p) => (p.id === patientId ? { ...p, portalPin: pin } : p)),
        });
        return pin;
      },
      resetDemo: () => commit(resetCareState()),
      updateCare: (updater) => commit(updater(state)),
      undoLast: () => {
        const last = undoRef.current.pop();
        setCanUndo(undoRef.current.some((item) => Date.now() - item.at < 5 * 60 * 1000));
        if (!last || Date.now() - last.at > 5 * 60 * 1000) return false;
        skipUndo.current = true;
        commit(last.prev);
        return true;
      },
      canUndo,
      offline,
      visitsByStage: (stage) => state.visits.filter((v) => v.stage === stage),
      todayVisits: visitsToday(state.visits),
      avgWaitMinutes: averageWaitMinutes(state.visits),
      activity: staffActivity(state),
    }),
    [state, commit, user?.id, syncError, applyServerState, canUndo, offline],
  );

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare(): CareContextValue {
  const ctx = useContext(CareContext);
  if (!ctx) throw new Error('useCare must be used within CareProvider');
  return ctx;
}
