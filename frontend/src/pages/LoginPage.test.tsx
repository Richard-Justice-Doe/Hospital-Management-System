import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';
import { CareProvider } from '../context/CareContext';

describe('LoginPage', () => {
  it('renders the staff sign-in form', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <CareProvider>
            <LoginPage />
          </CareProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /clinic management system/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /patient portal/i }).length).toBeGreaterThan(0);
  });
});
