import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewVisitPage from './NewVisitPage';

const { updateCare, stateRef } = vi.hoisted(() => ({
  updateCare: vi.fn((fn: (state: unknown) => unknown) => fn(stateRef.current)),
  stateRef: { current: null as unknown },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'staff-reception', role: 'RECEPTIONIST', firstName: 'Sam', lastName: 'Desk', email: 'reception@clinic.local' },
  }),
}));

vi.mock('../../context/CareContext', async () => {
  const { createSeedState } = await import('../../workflow/seed');
  stateRef.current = createSeedState();
  return {
    useCare: () => ({
      state: stateRef.current,
      updateCare,
      patientCopayers: (patientId: string) =>
        (stateRef.current as { copayers: Array<{ patientId: string }> }).copayers.filter((item) => item.patientId === patientId),
    }),
  };
});

function renderCheckIn() {
  return render(
    <MemoryRouter initialEntries={['/care/reception/visit']}>
      <Routes>
        <Route path="/care/reception/visit" element={<NewVisitPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  updateCare.mockClear();
});

describe('Patient Check In', () => {
  it('shows the HIS check-in desk with billing lines and today’s list', () => {
    renderCheckIn();
    expect(screen.getByRole('heading', { name: /patient check in/i })).toBeInTheDocument();
    expect(screen.getByText(/process date/i)).toBeInTheDocument();
    expect(screen.getByText(/select your check in point/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/claim check code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get cc code/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/folder no/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment type/i)).toBeInTheDocument();
    expect(screen.getByText('Service Name')).toBeInTheDocument();
    expect(screen.getByText(/total : gh₵/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    expect(screen.getAllByText('GENERAL CONSULTATION').length).toBeGreaterThan(0);
    expect(screen.getByText(/patel nina/i)).toBeInTheDocument();
  });

  it('loads folder details and last visit, then saves with a CC code', () => {
    renderCheckIn();
    fireEvent.change(screen.getByLabelText(/folder no/i), { target: { value: 'A1/2026' } });
    fireEvent.blur(screen.getByLabelText(/folder no/i));
    expect(screen.getByDisplayValue('OWUSU AMARA')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NHIS')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NHIS-2049183')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2027-04-15')).toBeInTheDocument();
    expect(screen.getByText(/patient last visit:/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/claim check code/i), { target: { value: '55110' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(updateCare).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /record saved successfully/i })).toBeInTheDocument();
    expect(screen.getByText(/sent to cash and nursing/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
    expect(screen.queryByRole('heading', { name: /record saved successfully/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('OWUSU AMARA')).not.toBeInTheDocument();
  });

  it('blocks NHIS check-in when the CC code is missing', () => {
    renderCheckIn();
    fireEvent.change(screen.getByLabelText(/folder no/i), { target: { value: 'A1/2026' } });
    fireEvent.blur(screen.getByLabelText(/folder no/i));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(updateCare).not.toHaveBeenCalled();
    expect(screen.getByText(/5-digit cc code/i)).toBeInTheDocument();
    expect(screen.getByText(/nhis, hin, and ghana card/i)).toBeInTheDocument();
  });

  it('lets staff pick a priced service and add it to the bill', () => {
    renderCheckIn();
    fireEvent.change(screen.getByLabelText(/folder no/i), { target: { value: 'A1/2026' } });
    fireEvent.blur(screen.getByLabelText(/folder no/i));
    fireEvent.focus(screen.getByLabelText(/^item$/i));
    expect(screen.getByRole('listbox', { name: /services/i })).toBeInTheDocument();
    expect(screen.getByText('General OPD consultation')).toBeInTheDocument();
    expect(screen.getAllByText('GH₵ 50.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('option', { name: /general opd consultation/i }));
    expect(screen.getAllByDisplayValue('50.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByText(/total : gh₵ 50.00/i)).toBeInTheDocument();
  });

  it('blocks a second check-in for someone already seen today', () => {
    renderCheckIn();
    fireEvent.change(screen.getByLabelText(/folder no/i), { target: { value: 'A5/2026' } });
    fireEvent.blur(screen.getByLabelText(/folder no/i));
    expect(screen.getByRole('heading', { name: /already checked in today/i })).toBeInTheDocument();
    expect(screen.getByText(/cannot be checked in again until tomorrow/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(updateCare).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /already checked in today/i })).toBeInTheDocument();
  });

  it('prompts expired NHIS cover and checks the person in as private', () => {
    const state = stateRef.current as { patients: Array<{ id: string; nhisExpires?: string }> };
    const amara = state.patients.find((person) => person.id === 'pat-amara');
    const previous = amara?.nhisExpires;
    if (amara) amara.nhisExpires = '2025-01-01';
    try {
      renderCheckIn();
      fireEvent.change(screen.getByLabelText(/folder no/i), { target: { value: 'A1/2026' } });
      fireEvent.blur(screen.getByLabelText(/folder no/i));
      expect(screen.getByRole('heading', { name: /nhis \/ ghana card expired/i })).toBeInTheDocument();
      expect(screen.getByText(/owusu amara's nhis \/ hin \/ ghana card has expired/i)).toBeInTheDocument();
      expect(screen.getByText(/she will be checked in as private/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('NHIS')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(updateCare).toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: /record saved successfully/i })).toBeInTheDocument();
    } finally {
      if (amara) amara.nhisExpires = previous;
    }
  });
});
