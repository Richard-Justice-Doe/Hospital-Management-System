import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AuthError } from '../lib/api';
import { USE_SERVER, loginRequest, logoutRequest, meRequest, type AuthUserDto } from '../lib/server';
import { authenticateStaff, loadCareState } from '../workflow/store';
import { clearAssistantHistory } from '../workflow/assistantSession';
import { isLoginLocked, recordLoginAttempt, SESSION_MS } from '../workflow/his';
import type { StaffRole } from '../workflow/types';

export type AuthUser = AuthUserDto;

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  touch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'cms_auth';
const ACTIVITY_KEY = 'cms_auth_activity';

function loadUser(): AuthUser | null {
  if (USE_SERVER) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const activity = Number(localStorage.getItem(ACTIVITY_KEY) ?? '0');
    if (activity && Date.now() - activity > SESSION_MS) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVITY_KEY);
      return null;
    }
    const parsed = JSON.parse(raw) as AuthUser;
    const staff = loadCareState().staff.find((s) => s.id === parsed.id && s.isActive);
    if (!staff) return null;
    return {
      id: staff.id,
      email: staff.email,
      firstName: staff.firstName,
      lastName: staff.lastName,
      role: staff.role,
      inChargeOf: staff.inChargeOf,
      department: staff.department,
      permissions: staff.permissions,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadUser());
  const [isLoading, setIsLoading] = useState(USE_SERVER);

  const logout = useCallback(() => {
    clearAssistantHistory();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    if (USE_SERVER) void logoutRequest().catch(() => undefined);
    setUser(null);
  }, []);

  const touch = useCallback(() => {
    if (!user) return;
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  }, [user]);

  useEffect(() => {
    if (!USE_SERVER) return;
    void meRequest()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    touch();
    const onEvent = () => touch();
    window.addEventListener('click', onEvent);
    window.addEventListener('keydown', onEvent);
    const timer = window.setInterval(() => {
      const activity = Number(localStorage.getItem(ACTIVITY_KEY) ?? '0');
      if (Date.now() - activity > SESSION_MS) logout();
    }, 30_000);
    return () => {
      window.removeEventListener('click', onEvent);
      window.removeEventListener('keydown', onEvent);
      window.clearInterval(timer);
    };
  }, [user, touch, logout]);

  const login = useCallback(async (email: string, password: string) => {
    if (USE_SERVER) {
      const result = await loginRequest(email, password);
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      clearAssistantHistory();
      setUser(result.user);
      return;
    }

    if (isLoginLocked()) {
      throw new AuthError('Too many failed sign-ins. Wait one minute.');
    }
    const found = authenticateStaff(loadCareState(), email, password);
    if (found === 'invalid' || found === null) {
      const guard = recordLoginAttempt(false);
      throw new AuthError(guard.locked ? 'Too many failed sign-ins. Wait one minute.' : 'Invalid email or password');
    }
    recordLoginAttempt(true);
    const nextUser: AuthUser = {
      id: found.id,
      email: found.email,
      firstName: found.firstName,
      lastName: found.lastName,
      role: found.role,
      department: found.department,
      inChargeOf: found.inChargeOf,
      permissions: found.permissions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    clearAssistantHistory();
    setUser(nextUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout, touch }),
    [user, isLoading, login, logout, touch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const APP_HOME = '/care/dashboard';

export const ROLE_HOME: Record<StaffRole, string> = {
  ADMIN: APP_HOME,
  RECEPTIONIST: APP_HOME,
  NURSE: APP_HOME,
  DOCTOR: APP_HOME,
  PHARMACIST: APP_HOME,
  LAB: APP_HOME,
  RADIOLOGY: APP_HOME,
  PHYSIO: APP_HOME,
  CASHIER: '/care/billing',
  ACCOUNTANT: '/care/billing',
  EYE_DOCTOR: APP_HOME,
  EYE_NURSE: APP_HOME,
  ENT_DOCTOR: APP_HOME,
  ENT_NURSE: APP_HOME,
  DENTIST: APP_HOME,
  MIDWIFE: APP_HOME,
};
