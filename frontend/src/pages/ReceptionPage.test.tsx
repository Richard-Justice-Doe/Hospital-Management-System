import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReceptionLayout from './reception/ReceptionLayout';
import CashPatientRecordsPage from './cash/CashPatientRecordsPage';

const { createFolder, checkIn, updateFolder } = vi.hoisted(() => ({
  createFolder: vi.fn(),
  checkIn: vi.fn(),
  updateFolder: vi.fn(),
}));

vi.mock('../workflow/printReceipt', async () => {
  const actual = await vi.importActual<typeof import('../workflow/printReceipt')>('../workflow/printReceipt');
  return { ...actual, printIdCard: vi.fn() };
});

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
      createFolder,
      updateFolder,
      openFolder: vi.fn(),
      checkIn,
      saveCopayer: vi.fn(),
      removeCopayer: vi.fn(),
      patientCopayers: () => [],
    }),
  };
});

function renderRecords() {
  return render(
    <MemoryRouter initialEntries={['/care/reception/patients']}>
      <Routes>
        <Route path="/care/reception" element={<ReceptionLayout />}>
          <Route path="patients" element={<CashPatientRecordsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Reception patient administration', () => {
  afterEach(() => {
    cleanup();
    createFolder.mockReset();
    checkIn.mockReset();
    updateFolder.mockReset();
  });

  it('shows HIS patient administration desks without mixing billing into records', () => {
    renderRecords();
    expect(screen.getByRole('heading', { name: /patient administration/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /patient administration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /assign copayer patient/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /patient check in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /patient records/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bill later/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /today’s visits/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /patient records/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add new patient/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save new patient & create folder/i })).not.toBeInTheDocument();
  });

  it('saves a new folder from patient records without checking the patient in', async () => {
    const user = userEvent.setup();
    createFolder.mockReturnValue({ ok: true, hospitalNo: 'A99/2026', portalPin: '111111' });
    renderRecords();
    await user.click(screen.getByRole('button', { name: /add new patient/i }));
    await user.type(screen.getByLabelText(/sur name/i), 'Mensah');
    await user.type(screen.getByPlaceholderText('other name'), 'Abena');
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1995-06-01' } });
    await user.selectOptions(screen.getByLabelText(/^gender/i), 'Female');
    await user.type(screen.getByPlaceholderText('telephone number'), '024 555 0101');
    await user.click(screen.getByRole('button', { name: /select sponsor/i }));
    await user.click(screen.getByRole('button', { name: /government of ghana/i }));
    await user.click(screen.getByRole('button', { name: /select insurance/i }));
    await user.click(screen.getByRole('button', { name: /^nhis$/i }));
    await user.type(screen.getByPlaceholderText('Member ID'), 'NHIS-100');
    await user.click(screen.getByRole('button', { name: /save patient record/i }));

    expect(createFolder).toHaveBeenCalledTimes(1);
    expect(checkIn).not.toHaveBeenCalled();
    const payload = createFolder.mock.calls[0]?.[0] as { lastName: string; firstName: string; consentTreatment: boolean; sponsor: string };
    expect(payload.lastName).toBe('Mensah');
    expect(payload.firstName).toBe('Abena');
    expect(payload.consentTreatment).toBe(true);
    expect(payload.sponsor).toBe('GOVERNMENT');
    expect(screen.getByText(/a99\/2026/i)).toBeInTheDocument();
  }, 15000);

  it('lists HIS sponsors including corporate, not a separate corporate scheme radio', async () => {
    const user = userEvent.setup();
    renderRecords();
    await user.click(screen.getByRole('button', { name: /add new patient/i }));
    await user.click(screen.getByRole('button', { name: /select sponsor/i }));
    expect(screen.getByRole('button', { name: /government of ghana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /private insurance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^corporate$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^private$/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /private insurance/i }));
    await user.click(screen.getByRole('button', { name: /select insurance/i }));
    expect(screen.getByRole('button', { name: /acacia insurance/i })).toBeInTheDocument();
  });

  it('loads a saved folder for editing without changing the hospital number', async () => {
    const user = userEvent.setup();
    updateFolder.mockReturnValue({
      ok: true,
      patient: {
        id: 'pat-amara',
        hospitalNo: 'A1/2026',
        firstName: 'Amara',
        lastName: 'Owusu',
        age: 34,
        gender: 'Female',
        phone: '024 000 9999',
      },
    });
    renderRecords();

    await user.click(screen.getByRole('button', { name: /edit folder for amara owusu/i }));

    expect(screen.getByRole('heading', { name: /edit folder/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/sur name/i)).toHaveValue('Owusu');
    expect(screen.getByPlaceholderText('other name')).toHaveValue('Amara');
    expect(screen.getByPlaceholderText('telephone number')).toHaveValue('024 111 0101');
    expect(screen.getByLabelText(/folder number/i)).toHaveValue('A1/2026');
    expect(screen.getByLabelText(/folder number/i)).toHaveProperty('readOnly', true);
    expect(screen.getByLabelText(/registration date/i)).toHaveProperty('readOnly', true);

    await user.clear(screen.getByPlaceholderText('telephone number'));
    await user.type(screen.getByPlaceholderText('telephone number'), '024 000 9999');
    await user.click(screen.getByRole('button', { name: /save patient record/i }));

    expect(updateFolder).toHaveBeenCalledTimes(1);
    expect(createFolder).not.toHaveBeenCalled();
    expect(updateFolder.mock.calls[0]?.[0]).toBe('pat-amara');
    expect(updateFolder.mock.calls[0]?.[1]).toMatchObject({
      firstName: 'Amara',
      lastName: 'Owusu',
      phone: '024 000 9999',
      hospitalNo: 'A1/2026',
    });
    expect(screen.getAllByText(/a1\/2026/i).length).toBeGreaterThan(0);
  }, 15000);
});
