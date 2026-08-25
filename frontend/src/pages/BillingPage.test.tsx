import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BillingPage from './BillingPage';

const { updateCare, stateRef } = vi.hoisted(() => ({
  updateCare: vi.fn((fn: (state: unknown) => unknown) => fn(stateRef.current)),
  stateRef: { current: null as unknown },
}));

vi.mock('../workflow/printReceipt', async () => {
  const actual = await vi.importActual<typeof import('../workflow/printReceipt')>('../workflow/printReceipt');
  return { ...actual, printVisitBill: vi.fn() };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'staff-cashier', role: 'CASHIER', firstName: 'Efua', lastName: 'Cashier', email: 'cashier@clinic.local' },
  }),
}));

vi.mock('../context/CareContext', async () => {
  const { createSeedState } = await import('../workflow/seed');
  stateRef.current = createSeedState();
  return {
    useCare: () => ({
      state: stateRef.current,
      updateCare,
    }),
  };
});

afterEach(() => {
  cleanup();
  updateCare.mockClear();
});

describe('Generate bill', () => {
  it('shows the HIS generate-bill desk for out-patients', () => {
    render(<BillingPage />);
    expect(screen.getByRole('heading', { name: /generate bill/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /out-patient/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /in-patient/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/process date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select your check in point/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/claim check code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get cc code/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/folder no/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^search$/i)).toBeInTheDocument();
    expect(screen.getAllByText('Patient Name').length).toBeGreaterThan(0);
    expect(screen.getByText('F/No.')).toBeInTheDocument();
    expect(screen.getByText('Service Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    expect(screen.getByText(/total : gh₵/i)).toBeInTheDocument();
    expect(screen.getAllByText('GENERAL CONSULTATION').length).toBeGreaterThan(0);
    expect(screen.getByText(/nina/i)).toBeInTheDocument();
  });

  it('fills folder details when a patient is selected', () => {
    render(<BillingPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: /select nina patel/i }));
    expect(screen.getByDisplayValue('A5/2026')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PATEL NINA')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NHIS')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NHIS-330184')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-11-12')).toBeInTheDocument();
    expect(screen.getByText(/patient last visit:/i)).toBeInTheDocument();
  });

  it('loads the same check-in folder fields from the folder number', () => {
    render(<BillingPage />);
    fireEvent.change(screen.getByLabelText(/folder no/i), { target: { value: 'A5/2026' } });
    fireEvent.blur(screen.getByLabelText(/folder no/i));
    expect(screen.getByDisplayValue('PATEL NINA')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NHIS')).toBeInTheDocument();
    expect(screen.getByText(/patient last visit:/i)).toBeInTheDocument();
  });

  it('lets the cashier pick a priced service and add it to the bill', () => {
    render(<BillingPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: /select nina patel/i }));
    fireEvent.focus(screen.getByLabelText(/^item$/i));
    expect(screen.getByRole('listbox', { name: /services/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /malaria rdt/i }));
    expect(screen.getAllByDisplayValue('25.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByRole('button', { name: /remove malaria rdt/i })).toBeInTheDocument();
    expect(screen.getByText('Malaria RDT')).toBeInTheDocument();
  });

  it('prompts expired NHIS cover and bills the visit as private', () => {
    const state = stateRef.current as { patients: Array<{ id: string; nhisExpires?: string }> };
    const nina = state.patients.find((person) => person.id === 'pat-nina');
    const previous = nina?.nhisExpires;
    if (nina) nina.nhisExpires = '2025-01-01';
    try {
      render(<BillingPage />);
      fireEvent.click(screen.getByRole('checkbox', { name: /select nina patel/i }));
      expect(screen.getByRole('heading', { name: /nhis \/ ghana card expired/i })).toBeInTheDocument();
      expect(screen.getByText(/she will be checked in as private/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('NHIS')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
      fireEvent.focus(screen.getByLabelText(/^item$/i));
      fireEvent.click(screen.getByRole('option', { name: /malaria rdt/i }));
      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(updateCare).toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: /record saved successfully/i })).toBeInTheDocument();
    } finally {
      if (nina) nina.nhisExpires = previous;
    }
  });
});
