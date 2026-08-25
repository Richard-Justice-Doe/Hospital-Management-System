import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CashPatientRecordsPage from './CashPatientRecordsPage';

vi.mock('../../workflow/printReceipt', async () => {
  const actual = await vi.importActual<typeof import('../../workflow/printReceipt')>('../../workflow/printReceipt');
  return { ...actual, printIdCard: vi.fn() };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'staff-cashier', role: 'CASHIER', firstName: 'Efua', lastName: 'Cashier' },
  }),
}));

vi.mock('../../context/CareContext', async () => {
  const { createSeedState } = await import('../../workflow/seed');
  return {
    useCare: () => ({
      state: createSeedState(),
      createFolder: () => ({ ok: true, hospitalNo: 'A9/2026' }),
      updateFolder: () => ({ ok: true }),
    }),
  };
});

afterEach(() => {
  cleanup();
});

describe('Cash patient records', () => {
  it('shows the HIS patient records table', () => {
    render(
      <MemoryRouter>
        <CashPatientRecordsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /patient records/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add new patient/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print patient card/i })).toBeInTheDocument();
    expect(screen.getByText('Record No.')).toBeInTheDocument();
    expect(screen.getByText('Insurance')).toBeInTheDocument();
    expect(screen.getByText('Entered By')).toBeInTheDocument();
    expect(screen.getByText(/patel nina/i)).toBeInTheDocument();
  });

  it('opens the patient information form', () => {
    render(
      <MemoryRouter>
        <CashPatientRecordsPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /add new patient/i }));
    expect(screen.getByRole('heading', { name: /patient information/i })).toBeInTheDocument();
    expect(screen.getByText(/sur name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save patient record/i })).toBeInTheDocument();
    expect(screen.getAllByText(/sponsor/i).length).toBeGreaterThan(1);
  });
});
