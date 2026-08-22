import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminLayout from './AdminLayout';
import AdminOverviewPage from './AdminOverviewPage';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'staff-admin', email: 'admin@clinic.local', firstName: 'System', lastName: 'Admin', role: 'ADMIN' },
    logout: () => undefined,
  }),
}));

vi.mock('../../context/CareContext', async () => {
  const { createSeedState } = await import('../../workflow/seed');
  const { staffActivity, visitsToday, averageWaitMinutes } = await import('../../workflow/store');
  const state = createSeedState();
  return {
    useCare: () => ({
      state,
      todayVisits: visitsToday(state.visits),
      avgWaitMinutes: averageWaitMinutes(state.visits),
      activity: staffActivity(state),
      resetDemo: () => undefined,
    }),
  };
});

describe('Admin pages', () => {
  it('shows admin tabs and overview totals', () => {
    render(
      <MemoryRouter initialEntries={['/care/admin/overview']}>
        <Routes>
          <Route path="/care/admin" element={<AdminLayout />}>
            <Route path="overview" element={<AdminOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /^admin$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^staff/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /services/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /appointment schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /patient records/i })).toBeInTheDocument();
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getAllByText('Patients').length).toBeGreaterThan(0);
    expect(screen.getByText('Staffs')).toBeInTheDocument();
    expect(screen.getByText('Wards')).toBeInTheDocument();
  });
});
