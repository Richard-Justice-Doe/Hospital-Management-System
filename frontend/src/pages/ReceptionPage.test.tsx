import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReceptionLayout from './reception/ReceptionLayout';
import NewPatientPage from './reception/NewPatientPage';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'staff-reception', role: 'RECEPTIONIST', firstName: 'Sam', lastName: 'Desk', email: 'reception@clinic.local', clinicIds: [] },
  }),
}));

vi.mock('../context/CareContext', async () => {
  const { createSeedState } = await import('../workflow/seed');
  const seed = createSeedState();
  return {
    useCare: () => ({
      state: seed,
      registerNewPatient: vi.fn(),
      createFolder: vi.fn(),
      openFolder: vi.fn(),
      checkIn: vi.fn(),
      saveCopayer: vi.fn(),
      removeCopayer: vi.fn(),
      patientCopayers: () => [],
    }),
  };
});

describe('Reception patient administration', () => {
  it('shows patient administration with the new patient form', () => {
    render(
      <MemoryRouter initialEntries={['/care/reception/patients']}>
        <Routes>
          <Route path="/care/reception" element={<ReceptionLayout />}>
            <Route path="patients" element={<NewPatientPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /reception/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /patient administration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new patients/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new visit & billing/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /co-payer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save new patient & create folder/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/folder date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/folder number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/where the patient stays/i)).toBeInTheDocument();
    expect(screen.getByText('Private patient')).toBeInTheDocument();
    expect(screen.getByText(/no nhis card and no private insurance/i)).toBeInTheDocument();
  });
});
