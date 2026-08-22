import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DepartmentDashboardPage from './DepartmentDashboardPage';

vi.mock('../context/CareContext', async () => {
  const { createSeedState } = await import('../workflow/seed');
  return {
    useCare: () => ({ state: createSeedState() }),
  };
});

describe('DepartmentDashboardPage', () => {
  it('shows hospital totals and a department table', () => {
    render(
      <MemoryRouter>
        <DepartmentDashboardPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /department dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getAllByText('Total visits').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Registration').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NHIS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Private').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total check-ins').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: /department/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /activity through today/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /total visits by department/i })).toBeInTheDocument();
    expect(screen.getByText('Every department')).toBeInTheDocument();
  });
});
