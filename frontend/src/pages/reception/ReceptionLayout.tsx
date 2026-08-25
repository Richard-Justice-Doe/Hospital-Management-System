import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { DeskLayout, DeskPage, FeatureLink, FeatureRail, PageHeader } from '../../components/PageChrome';

const ADMIN = [
  { to: '/care/reception/copayer', label: 'Assign Copayer Patient' },
  { to: '/care/reception/visit', label: 'Patient Check In' },
  { to: '/care/reception/patients', label: 'Patient Records' },
];

const EXTRA = [
  { to: '/care/reception/visit?mode=bill', label: 'Bill later' },
  { to: '/care/reception/visits', label: 'Today’s visits' },
  { to: '/care/reception/merge', label: 'Fix duplicates' },
];

function tabActive(to: string, pathname: string, mode: string | null) {
  if (to.includes('mode=bill')) return pathname.endsWith('/visit') && mode === 'bill';
  if (to.endsWith('/visit')) return pathname.endsWith('/visit') && mode !== 'bill';
  return pathname.startsWith(to);
}

export default function ReceptionLayout() {
  const location = useLocation();
  const [params] = useSearchParams();
  const mode = params.get('mode');
  const onVisitDesk = location.pathname.endsWith('/visit') || location.pathname.endsWith('/visits');

  return (
    <DeskPage>
      <PageHeader
        title="Patient Administration"
        hint={
          onVisitDesk
            ? 'Patient check-in starts a visit for an existing folder. Open Patient Records first if they have no folder.'
            : 'Reception records: assign a copayer, check the patient in, or open a folder from Patient Records.'
        }
      />
      <DeskLayout
        rail={
          <>
            <FeatureRail label="Patient Administration">
              {ADMIN.map((tab) => (
                <FeatureLink key={tab.to} to={tab.to} active={tabActive(tab.to, location.pathname, mode)}>
                  {tab.label}
                </FeatureLink>
              ))}
            </FeatureRail>
            <FeatureRail label="Visit tools">
              {EXTRA.map((tab) => (
                <FeatureLink key={tab.to} to={tab.to} active={tabActive(tab.to, location.pathname, mode)}>
                  {tab.label}
                </FeatureLink>
              ))}
            </FeatureRail>
          </>
        }
      >
        <Outlet />
      </DeskLayout>
    </DeskPage>
  );
}
