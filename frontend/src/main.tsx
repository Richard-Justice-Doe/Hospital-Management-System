import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { CareProvider } from './context/CareContext';
import LoginPage from './pages/LoginPage';
import PortalPage from './pages/PortalPage';
import './index.css';

const StaffApp = lazy(() => import('./App'));

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/portal"
              element={
                <CareProvider>
                  <PortalPage />
                </CareProvider>
              }
            />
            <Route
              path="*"
              element={
                <CareProvider>
                  <ErrorBoundary>
                    <Suspense fallback={<p className="p-8 text-sm text-slate-600">Opening the staff portal…</p>}>
                      <StaffApp />
                    </Suspense>
                  </ErrorBoundary>
                </CareProvider>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
