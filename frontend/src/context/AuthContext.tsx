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
import { authenticateStaff, loadCareState, saveCareState } from '../workflow/store';
import { appendFailedLogin, rememberFailedLogin } from '../workflow/itDesk';
import { clearAssistantHistory } from '../workflow/assistantSession';
import { isLoginLocked, recordLoginAttempt, SESSION_MS } from '../workflow/his';
import type { StaffAccount, StaffRole } from '../workflow/types';

export type AuthUser = AuthUserDto;

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  touch: () => void;
  applyStaffSession: (staff: StaffAccount) => void;
  refreshIfCurrent: (staff: StaffAccount) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'cms_auth';
const ACTIVITY_KEY = 'cms_auth_activity';

function staffToUser(staff: StaffAccount): AuthUser {
  return {
    id: staff.id,
    email: staff.email,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    department: staff.department,
    inChargeOf: staff.inChargeOf,
    permissions: staff.permissions,
  };
}

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
    return staffToUser(staff);
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

  const applyStaffSession = useCallback((staff: StaffAccount) => {
    const nextUser = staffToUser(staff);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const refreshIfCurrent = useCallback((staff: StaffAccount) => {
    setUser((current) => {
      if (!current || current.id !== staff.id) return current;
      const nextUser = staffToUser(staff);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  }, []);

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
      const next = appendFailedLogin(loadCareState(), email, found === 'invalid' ? 'Wrong password' : 'Unknown user');
      saveCareState(next);
      if (next.failedLogins[0]) rememberFailedLogin(next.failedLogins[0]);
      throw new AuthError(guard.locked ? 'Too many failed sign-ins. Wait one minute.' : 'Invalid username, email, or password');
    }
    recordLoginAttempt(true);
    applyStaffSession(found);
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    clearAssistantHistory();
  }, [applyStaffSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout, touch, applyStaffSession, refreshIfCurrent }),
    [user, isLoading, login, logout, touch, applyStaffSession, refreshIfCurrent],
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
  MATRON: APP_HOME,
  CLAIMS: APP_HOME,
  STOREKEEPER: APP_HOME,
  PROCUREMENT: APP_HOME,
  IT: APP_HOME,
};
