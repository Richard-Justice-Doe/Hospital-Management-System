import type { CareState, Department, ServiceOrder, StaffRole, VisitRecord } from './types';
import { ROLE_BILLABLE_DEPARTMENTS } from './types';

export type CollectionPeriod = 'day' | 'month' | 'year' | 'all';

export function orderIsPaid(order: ServiceOrder): boolean {
  return Boolean(order.paidAt);
}

export function billableDepartmentsFor(role: StaffRole): Department[] | 'ALL' {
  return ROLE_BILLABLE_DEPARTMENTS[role];
}

export function unpaidOrders(visit: VisitRecord, departments: Department[] | 'ALL' = 'ALL'): ServiceOrder[] {
  if (visit.billable === false) return [];
  return visit.orders.filter((order) => {
    if (order.chargeable === false) return false;
    if (orderIsPaid(order)) return false;
    if (departments === 'ALL') return true;
    return departments.includes(order.department);
  });
}

export function unpaidTotal(orders: Pick<ServiceOrder, 'priceGhs' | 'paidAt'>[]): number {
  return orders.filter((order) => !order.paidAt).reduce((sum, order) => sum + order.priceGhs, 0);
}

export function visitBalance(visit: VisitRecord, departments: Department[] | 'ALL' = 'ALL'): number {
  return unpaidOrders(visit, departments).reduce((sum, order) => sum + order.priceGhs, 0);
}

export function inCollectionPeriod(iso: string, period: CollectionPeriod, now = new Date()): boolean {
  const paid = new Date(iso);
  if (Number.isNaN(paid.getTime())) return false;
  if (period === 'all') return true;
  if (period === 'day') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return paid >= start;
  }
  if (period === 'month') {
    return paid.getFullYear() === now.getFullYear() && paid.getMonth() === now.getMonth();
  }
  return paid.getFullYear() === now.getFullYear();
}

export function paidAmount(state: CareState, period: CollectionPeriod, now = new Date()): number {
  return state.visits.reduce((sum, visit) => {
    return (
      sum +
      visit.orders
        .filter((order) => order.paidAt && order.chargeable !== false && inCollectionPeriod(order.paidAt, period, now))
        .reduce((inner, order) => inner + order.priceGhs, 0)
    );
  }, 0);
}

export function collectionsSummary(state: CareState, now = new Date()) {
  return {
    day: paidAmount(state, 'day', now),
    month: paidAmount(state, 'month', now),
    year: paidAmount(state, 'year', now),
  };
}
