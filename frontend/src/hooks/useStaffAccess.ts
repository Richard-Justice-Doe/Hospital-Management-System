import { useAuth } from '../context/AuthContext';
import { useCare } from '../context/CareContext';
import { canAccessAny, canAccessPage, effectivePages, type PageKey, type StaffAccess } from '../workflow/permissions';

export function useStaffAccess(): StaffAccess | null {
  const { user } = useAuth();
  const { state } = useCare();
  if (!user) return null;
  const staff = state.staff.find((item) => item.id === user.id);
  const extra = staff ? staff.permissions?.extra : user.permissions?.extra;
  const hidden = staff ? staff.permissions?.hidden : user.permissions?.hidden;
  const role = staff?.role ?? user.role;
  return {
    role,
    department: staff?.department ?? user.department,
    rolePages: state.rolePageGrants?.[role],
    ...(extra?.length ? { extra } : {}),
    ...(hidden?.length ? { hidden } : {}),
  };
}

export function useCanOpen(page: PageKey | PageKey[]): boolean {
  const access = useStaffAccess();
  return Array.isArray(page) ? canAccessAny(access, page) : canAccessPage(access, page);
}

export function useOpenPages(): PageKey[] {
  const access = useStaffAccess();
  return access ? effectivePages(access) : [];
}
