import { describe, expect, it } from 'vitest';
import { createSeedState } from './seed';
import {
  accountantInboxTotals,
  claimQueue,
  claimSchemeOf,
  filterClaimQueue,
  issueSupply,
  receiveClaimRemittance,
  receivePurchase,
  receivePurchaseForAccounts,
  requestPurchase,
  sendPharmacyRestockToProcurement,
  setPurchaseStatus,
} from './supportDesks';

describe('support desks', () => {
  it('splits NHIS and private claim queues', () => {
    const rows = claimQueue(createSeedState());
    expect(rows.some((row) => row.scheme === 'NHIS' && row.patient?.lastName === 'Owusu')).toBe(true);
    expect(rows.some((row) => row.scheme === 'PRIVATE' && row.patient?.insuranceProvider === 'Acacia Health')).toBe(true);
    expect(filterClaimQueue(rows, 'nhis').every((row) => row.scheme === 'NHIS')).toBe(true);
    expect(filterClaimQueue(rows, 'private').every((row) => row.scheme === 'PRIVATE')).toBe(true);
    expect(claimSchemeOf({ insuranceType: 'CASH' })).toBeUndefined();
    expect(claimSchemeOf({ insuranceType: 'GOVERNMENT' }, { coverAsPrivate: true })).toBeUndefined();
  });

  it('issues store stock and receives a purchase into stores', () => {
    const seeded = createSeedState();
    const gloves = seeded.supplies.find((item) => item.id === 'sup-glove');
    expect(gloves).toBeTruthy();
    const issued = issueSupply(seeded, {
      supplyId: 'sup-glove',
      quantity: 2,
      toDepartment: 'LAB',
      issuedBy: 'staff-stores',
    });
    expect(issued.supplies.find((item) => item.id === 'sup-glove')?.quantity).toBe((gloves?.quantity ?? 0) - 2);
    expect(issued.storeIssues[0]?.toDepartment).toBe('LAB');

    const requested = requestPurchase(seeded, {
      itemName: 'Syringes 5ml (box)',
      quantity: 10,
      vendorId: 'ven-med',
      department: 'NURSING',
      requestedBy: 'staff-procurement',
      amountGhs: 40,
    });
    const po = requested.purchaseOrders[0];
    expect(po?.poNo).toMatch(/^PO-/);
    expect(po?.amountGhs).toBe(40);
    expect(requested.messages[0]?.toRole).toBe('ACCOUNTANT');
    const ordered = setPurchaseStatus(requested, po.id, 'ORDERED');
    const received = receivePurchase(ordered, po.id, 'staff-stores');
    expect(received.purchaseOrders.find((row) => row.id === po.id)?.status).toBe('RECEIVED');
    expect(received.supplies.some((item) => item.name === 'Syringes 5ml (box)' && item.quantity === 10)).toBe(true);
  });

  it('lets pharmacy send empty and low medicines to procurement once', () => {
    const seeded = createSeedState();
    const next = sendPharmacyRestockToProcurement(seeded, { requestedBy: 'staff-pharmacy' });
    const names = next.purchaseOrders.filter((row) => row.department === 'PHARMACY').map((row) => row.itemName);
    expect(names).toEqual(expect.arrayContaining(['Salbutamol inhaler', 'Soluble insulin vial', 'Zinc sulphate 20mg']));
    expect(next.messages.some((item) => item.toRole === 'PROCUREMENT')).toBe(true);
    expect(next.messages.some((item) => item.toRole === 'ACCOUNTANT')).toBe(true);
    expect(next.notifications.some((note) => note.title === 'Pharmacy restock request')).toBe(true);
    const again = sendPharmacyRestockToProcurement(next, { requestedBy: 'staff-pharmacy' });
    expect(again.purchaseOrders.filter((row) => row.itemName === 'Salbutamol inhaler').length).toBe(1);
    const po = next.purchaseOrders.find((row) => row.itemName === 'Salbutamol inhaler');
    expect(po?.stockId).toBe('stk-salb');
    const received = receivePurchase(next, po!.id, 'staff-procurement');
    expect(received.drugStock.find((item) => item.id === 'stk-salb')?.quantity).toBeGreaterThan(0);
    expect(received.purchaseOrders.find((row) => row.id === po!.id)?.status).toBe('RECEIVED');
  });

  it('lets the accountant receive remittance cash and purchase requests', () => {
    const seeded = createSeedState();
    const inbox = accountantInboxTotals(seeded);
    expect(inbox.remittanceWaiting).toBeGreaterThan(0);
    expect(inbox.purchasesCount).toBeGreaterThan(0);
    const afterClaim = receiveClaimRemittance(seeded, 'vis-amara', 'staff-accountant');
    expect(afterClaim.claims.find((item) => item.visitId === 'vis-amara')?.status).toBe('PAID');
    expect(afterClaim.claims.find((item) => item.visitId === 'vis-amara')?.accountsReceivedAt).toBeTruthy();
    expect(receiveClaimRemittance(afterClaim, 'vis-amara', 'staff-accountant').claims.find((item) => item.visitId === 'vis-amara')?.accountsReceivedBy).toBe(
      'staff-accountant',
    );
    const afterBuy = receivePurchaseForAccounts(seeded, 'po-gauze', 'staff-accountant');
    expect(afterBuy.purchaseOrders.find((row) => row.id === 'po-gauze')?.accountsReceivedBy).toBe('staff-accountant');
    expect(accountantInboxTotals(afterBuy).purchasesCount).toBeLessThan(inbox.purchasesCount);
  });
});
