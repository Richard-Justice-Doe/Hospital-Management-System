import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canReceivePayment } from '../../workflow/billing';
import AccountantDesk from '../AccountantDesk';
import { DeskLayout, DeskPage, FeatureLink, FeatureRail, PageHeader } from '../../components/PageChrome';

export const CASH_TABS = [
  { to: '/care/billing/bill', label: 'Generate Bill' },
  { to: '/care/billing/deposit', label: 'Patient Deposit' },
  { to: '/care/billing/receipts', label: 'Patient Receipt By User' },
  { to: '/care/billing/external', label: 'Print External Receipt' },
  { to: '/care/billing/print', label: 'Print Receipt' },
  { to: '/care/billing/sales', label: 'Sales Summary By User' },
  { to: '/care/billing/details', label: 'View Patient Bill Details' },
] as const;

export const PATIENT_ADMIN_TABS = [
  { to: '/care/billing/admin/copayer', label: 'Assign Copayer Patient' },
  { to: '/care/billing/admin/checkin', label: 'Patient Check In' },
  { to: '/care/billing/admin/records', label: 'Patient Records' },
] as const;

export default function CashLayout() {
  const { user } = useAuth();
  const location = useLocation();
  if (!canReceivePayment(user?.role)) return <AccountantDesk />;
  const onAdmin = location.pathname.startsWith('/care/billing/admin');

  return (
    <DeskPage>
      <PageHeader
        title="Cash unit"
        hint={
          onAdmin
            ? 'Patient administration on this desk: copayer, check-in, and folder records. Reception can do the same work.'
            : 'Generate bills, take deposits and cash, and print receipts.'
        }
      />
      <DeskLayout
        rail={
          <>
            <FeatureRail label="Select Feature">
              <FeatureLink to="/care/billing/bill" active={!onAdmin}>
                Billing
              </FeatureLink>
              <FeatureLink to="/care/billing/admin/records" active={onAdmin}>
                Patient Administration
              </FeatureLink>
            </FeatureRail>
            {onAdmin ? (
              <FeatureRail label="Patient Administration">
                {PATIENT_ADMIN_TABS.map((tab) => (
                  <FeatureLink key={tab.to} to={tab.to} active={location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`)}>
                    {tab.label}
                  </FeatureLink>
                ))}
              </FeatureRail>
            ) : (
              <FeatureRail label="Billing">
                {CASH_TABS.map((tab) => (
                  <FeatureLink key={tab.to} to={tab.to} active={location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`)}>
                    {tab.label}
                  </FeatureLink>
                ))}
              </FeatureRail>
            )}
          </>
        }
      >
        <Outlet />
      </DeskLayout>
    </DeskPage>
  );
}
