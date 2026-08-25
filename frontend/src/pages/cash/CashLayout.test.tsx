import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CashLayout from './CashLayout';

const auth = vi.hoisted(() => ({
  user: { id: 'staff-cashier', email: 'cashier@clinic.local', firstName: 'Efua', lastName: 'Cashier', role: 'CASHIER' as const },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: auth.user,
    logout: () => undefined,
  }),
}));

vi.mock('../../context/CareContext', async () => {
  const { createSeedState } = await import('../../workflow/seed');
  const state = createSeedState();
  return {
    useCare: () => ({
      state,
      updateCare: () => undefined,
    }),
  };
});

afterEach(() => {
  cleanup();
});

function renderCash(path = '/care/billing/bill') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/care/billing" element={<CashLayout />}>
          <Route path="bill" element={<p>Generate bill desk</p>} />
          <Route path="admin/records" element={<p>Patient records desk</p>} />
          <Route path="admin/copayer" element={<p>Copayer desk</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Cash unit', () => {
  it('shows the seven billing desks for the cashier', () => {
    auth.user = { id: 'staff-cashier', email: 'cashier@clinic.local', firstName: 'Efua', lastName: 'Cashier', role: 'CASHIER' };
    renderCash();
    expect(screen.getByRole('heading', { name: /cash unit/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /select feature/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^billing$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /patient administration/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /billing/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /generate bill/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /patient deposit/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /patient receipt by user/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /print external receipt/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^print receipt$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sales summary by user/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view patient bill details/i })).toBeInTheDocument();
    expect(screen.getByText(/generate bill desk/i)).toBeInTheDocument();
  });

  it('opens patient administration desks from select feature', () => {
    auth.user = { id: 'staff-cashier', email: 'cashier@clinic.local', firstName: 'Efua', lastName: 'Cashier', role: 'CASHIER' };
    renderCash('/care/billing/admin/records');
    expect(screen.getByRole('navigation', { name: /patient administration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /assign copayer patient/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /patient check in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /patient records/i })).toBeInTheDocument();
    expect(screen.getByText(/patient records desk/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /generate bill/i })).not.toBeInTheDocument();
  });

  it('keeps accounts on the money books for the accountant', () => {
    auth.user = { id: 'staff-accounts', email: 'accounts@clinic.local', firstName: 'Ama', lastName: 'Books', role: 'ACCOUNTANT' };
    renderCash();
    expect(screen.getByRole('heading', { name: /accounts — money books/i })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /billing/i })).not.toBeInTheDocument();
  });
});
