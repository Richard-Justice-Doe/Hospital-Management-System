import { describe, expect, it } from 'vitest';
import { createSeedState } from './seed';
import {
  assignMissingQueueNumbers,
  ensureSampleLabel,
  inferAssetKind,
  itDeskStats,
  nextQueueNo,
  openTicket,
  updateTicket,
  upsertAsset,
} from './itDesk';

describe('IT desk', () => {
  it('opens a ticket and moves it through the queue', () => {
    const opened = openTicket(createSeedState(), {
      openedByStaffId: 'staff-reception',
      category: 'PRINTER',
      priority: 'HIGH',
      title: 'Reception printer jam',
      detail: 'Folder printer will not feed A4.',
      location: 'Records',
    });
    expect(opened.itTickets[0]?.status).toBe('OPEN');
    expect(opened.auditLog[0]?.action).toBe('it_ticket_open');
    const assigned = updateTicket(
      opened,
      opened.itTickets[0]!.id,
      { status: 'IN_PROGRESS', assignedToStaffId: 'staff-it' },
      'staff-it',
    );
    expect(assigned.itTickets[0]?.assignedToStaffId).toBe('staff-it');
    expect(assigned.itTickets[0]?.status).toBe('IN_PROGRESS');
    const stats = itDeskStats(assigned);
    expect(stats.inProgress).toBeGreaterThan(0);
  });

  it('records an asset assigned to a staff member or room', () => {
    const next = upsertAsset(
      createSeedState(),
      {
        id: '',
        name: 'Nursing laptop',
        location: 'Nursing',
        kind: 'PC',
        assignedStaffId: 'staff-nurse',
        serial: 'NB-NURS-02',
        status: 'IN_USE',
      },
      'staff-it',
    );
    expect(next.assets[0]?.name).toBe('Nursing laptop');
    expect(next.assets[0]?.assignedStaffId).toBe('staff-nurse');
    expect(next.auditLog[0]?.action).toBe('it_asset_create');
  });

  it('assigns daily queue numbers and sample accession labels', () => {
    const seeded = createSeedState();
    const at = new Date().toISOString();
    const first = nextQueueNo(seeded.visits, at);
    expect(first).toBeGreaterThan(0);
    const numbered = assignMissingQueueNumbers(
      seeded.visits.map((visit) => ({ ...visit, queueNo: undefined })),
    );
    expect(numbered.every((visit) => (visit.queueNo ?? 0) > 0)).toBe(true);
    const visit = seeded.visits[0];
    expect(visit).toBeTruthy();
    const withLab = {
      ...seeded,
      visits: seeded.visits.map((row) =>
        row.id === visit!.id
          ? {
              ...row,
              orders: [
                ...row.orders,
                {
                  id: 'ord-lab-label',
                  serviceId: 'lab-fbc',
                  name: 'FBC',
                  department: 'LAB' as const,
                  priceGhs: 25,
                  status: 'ORDERED' as const,
                },
              ],
            }
          : row,
      ),
    };
    const labelled = ensureSampleLabel(withLab, visit!.id, 'ord-lab-label', 'staff-lab');
    const saved = labelled.visits.find((row) => row.id === visit!.id)?.orders.find((row) => row.id === 'ord-lab-label');
    expect(saved?.accessionNo).toMatch(/^ACC-/);
    expect(labelled.samples[0]?.orderId).toBe('ord-lab-label');
  });

  it('infers asset kinds from names', () => {
    expect(inferAssetKind('Reception PC')).toBe('PC');
    expect(inferAssetKind('Folder printer')).toBe('PRINTER');
    expect(inferAssetKind('Windows 11 license')).toBe('LICENSE');
  });
});
