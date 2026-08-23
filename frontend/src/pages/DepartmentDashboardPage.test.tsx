import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DepartmentDashboardPage from './DepartmentDashboardPage';

afterEach(() => {
  cleanup();
});

vi.mock('../context/CareContext', async () => {
  const { createSeedState } = await import('../workflow/seed');
  return {
    useCare: () => ({ state: createSeedState() }),
  };
});

const auth = vi.hoisted(() => ({
  user: { id: 'staff-admin', role: 'ADMIN', firstName: 'System', lastName: 'Admin' },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: auth.user,
    logout: () => undefined,
  }),
}));

describe('DepartmentDashboardPage', () => {
  it('shows the hospital dashboard for admin, not a generic department page', () => {
    auth.user = { id: 'staff-admin', role: 'ADMIN', firstName: 'System', lastName: 'Admin' };
    render(
      <MemoryRouter>
        <DepartmentDashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /hospital dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /quick access/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /on duty now/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^collections$/i })).toBeInTheDocument();
    expect(screen.getAllByText('Total visits').length).toBeGreaterThan(0);
    expect(screen.getByText('Every department')).toBeInTheDocument();
  });

  it('shows the nursing dashboard for a nurse', () => {
    auth.user = { id: 'staff-nurse', role: 'NURSE', firstName: 'Mary', lastName: 'Nurse', department: 'NURSING' } as typeof auth.user;
    render(
      <MemoryRouter>
        <DepartmentDashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /nursing dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('Waiting vitals')).toBeInTheDocument();
    expect(screen.queryByText('Every department')).not.toBeInTheDocument();
  });
});
