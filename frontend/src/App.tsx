import { type ReactNode } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import { DeskProvider } from './context/DeskContext';
import DepartmentDashboardPage from './pages/DepartmentDashboardPage';
import AssistantPage from './pages/AssistantPage';
import ReceptionLayout from './pages/reception/ReceptionLayout';
import NewVisitPage from './pages/reception/NewVisitPage';
import CopayerPage from './pages/reception/CopayerPage';
import VisitsPage from './pages/reception/VisitsPage';
import NursingPage from './pages/NursingPage';
import DoctorCarePage from './pages/DoctorCarePage';
import PharmacyPage, { DentalPage, EntPage, EyePage, LabPage, MaternityPage, PhysioPage, XrayPage } from './pages/PharmacyPage';
import BillingPage from './pages/BillingPage';
import CashLayout from './pages/cash/CashLayout';
import {
  CashBillDetailsPage,
  CashDepositPage,
  CashExternalReceiptPage,
  CashPrintReceiptPage,
  CashReceiptsByUserPage,
  CashSalesSummaryPage,
} from './pages/cash/CashDeskPages';
import CashPatientRecordsPage from './pages/cash/CashPatientRecordsPage';
import ClaimsDeskPage from './pages/ClaimsDeskPage';
import StoresPage from './pages/StoresPage';
import ProcurementPage from './pages/ProcurementPage';
import ItDeskPage from './pages/ItDeskPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminStaffPage from './pages/admin/AdminStaffPage';
import AdminServicesPage from './pages/admin/AdminServicesPage';
import AdminPatientsPage from './pages/admin/AdminPatientsPage';
import AdminBackupsPage from './pages/admin/AdminBackupsPage';
import ShiftsPage from './pages/ShiftsPage';
import type { PageKey } from './workflow/types';
import ChartPage from './pages/ChartPage';
import {
  AppointmentsPage,
  AuditPage,
  ClaimsPage,
  HrPage,
  InventoryPage,
  MessagesPage,
  MergePage,
  ReportsPage,
  TheatrePage,
  TriagePage,
  WardPage,
} from './pages/HisOpsPages';
import { canAccessAny, effectivePages, PAGE_PATH } from './workflow/permissions';
import { useStaffAccess } from './hooks/useStaffAccess';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p className="p-8 text-sm text-slate-500">Connecting to the hospital server…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function BillingToVisitRedirect() {
  const [params] = useSearchParams();
  const patient = params.get('patient');
  return <Navigate to={patient ? `/care/reception/visit?patient=${patient}` : '/care/reception/visit'} replace />;
}

function PageRoute({ page, children }: { page: PageKey | PageKey[]; children: ReactNode }) {
  const access = useStaffAccess();
  const pages = Array.isArray(page) ? page : [page];
  if (canAccessAny(access, pages)) return children;
  const homePage = access ? effectivePages(access)[0] : undefined;
  return <Navigate to={homePage ? PAGE_PATH[homePage] : '/login'} replace />;
}

function gated(page: PageKey | PageKey[], node: ReactNode) {
  return <PageRoute page={page}>{node}</PageRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <ProtectedRoute>
            <DeskProvider>
              <AppShell />
            </DeskProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/care/dashboard" replace />} />
        <Route path="/care/dashboard" element={gated('dashboard', <DepartmentDashboardPage />)} />
        <Route path="/care/assistant" element={gated('assistant', <AssistantPage />)} />
        <Route path="/care/chart" element={gated('chart', <ChartPage />)} />
        <Route path="/care/appointments" element={gated('appointments', <AppointmentsPage />)} />
        <Route path="/care/messages" element={gated('messages', <MessagesPage />)} />
        <Route path="/care/ward" element={gated('ward', <WardPage />)} />
        <Route path="/care/theatre" element={gated('theatre', <TheatrePage />)} />
        <Route path="/care/triage" element={gated('triage', <TriagePage />)} />
        <Route path="/care/reception" element={gated('reception', <ReceptionLayout />)}>
          <Route index element={<Navigate to="patients" replace />} />
          <Route path="patients" element={<CashPatientRecordsPage />} />
          <Route path="visit" element={<NewVisitPage />} />
          <Route path="billing" element={<BillingToVisitRedirect />} />
          <Route path="copayer" element={<CopayerPage />} />
          <Route path="visits" element={<VisitsPage />} />
          <Route path="merge" element={<MergePage />} />
        </Route>
        <Route path="/care/nursing" element={gated('nursing', <NursingPage />)} />
        <Route path="/care/doctor" element={gated('doctor', <DoctorCarePage />)} />
        <Route path="/care/lab" element={gated('lab', <LabPage />)} />
        <Route path="/care/xray" element={gated('xray', <XrayPage />)} />
        <Route path="/care/physio" element={gated('physio', <PhysioPage />)} />
        <Route path="/care/pharmacy" element={gated('pharmacy', <PharmacyPage />)} />
        <Route path="/care/eye" element={gated('eye', <EyePage />)} />
        <Route path="/care/ent" element={gated('ent', <EntPage />)} />
        <Route path="/care/dental" element={gated('dental', <DentalPage />)} />
        <Route path="/care/maternity" element={gated('maternity', <MaternityPage />)} />
        <Route path="/care/billing" element={gated(['billing', 'collections'], <CashLayout />)}>
          <Route index element={<Navigate to="bill" replace />} />
          <Route path="bill" element={<BillingPage />} />
          <Route path="deposit" element={<CashDepositPage />} />
          <Route path="receipts" element={<CashReceiptsByUserPage />} />
          <Route path="external" element={<CashExternalReceiptPage />} />
          <Route path="print" element={<CashPrintReceiptPage />} />
          <Route path="sales" element={<CashSalesSummaryPage />} />
          <Route path="details" element={<CashBillDetailsPage />} />
          <Route path="admin/copayer" element={<CopayerPage />} />
          <Route path="admin/checkin" element={<NewVisitPage />} />
          <Route path="admin/records" element={<CashPatientRecordsPage />} />
        </Route>
        <Route path="/care/claims" element={gated('claims', <ClaimsDeskPage />)} />
        <Route path="/care/stores" element={gated('stores', <StoresPage />)} />
        <Route path="/care/procurement" element={gated('procurement', <ProcurementPage />)} />
        <Route path="/care/it" element={gated('it', <ItDeskPage />)} />
        <Route path="/care/shifts" element={gated('shifts', <ShiftsPage />)} />
        <Route path="/care/admin" element={gated('admin', <AdminLayout />)}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverviewPage />} />
          <Route path="staff" element={<AdminStaffPage />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="patients" element={<AdminPatientsPage />} />
          <Route path="claims" element={<ClaimsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="hr" element={<HrPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="backups" element={<AdminBackupsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
