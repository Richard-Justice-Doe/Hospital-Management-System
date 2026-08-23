import { evaluateVitals } from './vitals';
import { describe, expect, it } from 'vitest';
import { allocatePatientFolder, applyVisitBilling, checkInByHospitalNo, checkInExisting, completeOrder, completeOrders, createPatientFolder, createStaff, payBill, payOrders, planCare, recordVitals, registerPatient, resetCareState, saveCareState, searchPatients, sendToDoctor, authenticateStaff } from './store';
import { visitMissingRequiredCc } from './patientAdmin';
import { unpaidOrders } from './billing';
import { createSeedState } from './seed';

describe('evaluateVitals', () => {
  it('flags fever and high blood pressure', () => {
    const flags = evaluateVitals({
      systolicBp: 150,
      diastolicBp: 95,
      temperatureC: 38.4,
      pulseBpm: 80,
      weightKg: 70,
      heightCm: 170,
      spo2: 98,
    });
    expect(flags).toContain('Fever');
    expect(flags).toContain('High blood pressure');
  });
});

describe('care workflow store', () => {
  it('registers a patient into the checked-in queue', () => {
    const next = registerPatient(createSeedState(), {
      firstName: 'Ada',
      lastName: 'Kofi',
      age: 22,
      gender: 'Female',
      phone: '+1-555-0190',
      reason: 'Headache',
      staffId: 'staff-reception',
    });
    expect(next.patients[0]?.firstName).toBe('Ada');
    expect(next.patients[0]?.hospitalNo).toBe(`A6/${new Date().getFullYear()}`);
    expect(next.visits[0]?.stage).toBe('CHECKED_IN');
    expect(next.visits[0]?.clinic).toBe('GENERAL');
    expect(next.visits[0]?.orders.some((o) => o.serviceId === 'reg-folder')).toBe(false);
    expect(next.visits[0]?.orders.some((o) => o.serviceId === 'opd-general')).toBe(false);
  });

  it('creates a patient folder with a hospital number without sending them to a clinic', () => {
    const next = createPatientFolder(createSeedState(), {
      firstName: 'Yaw',
      lastName: 'Asante',
      age: 31,
      gender: 'Male',
      phone: '+1-555-0192',
      staffId: 'staff-reception',
    });
    expect(next.patients[0]?.hospitalNo).toBe(`A6/${new Date().getFullYear()}`);
    expect(next.patients[0]?.folderCreatedAt).toBeTruthy();
    expect(next.visits.some((v) => v.patientId === next.patients[0]?.id)).toBe(false);
  });

  it('does not bill a second folder when a returning patient is checked in', () => {
    const seeded = createSeedState();
    const next = checkInByHospitalNo(seeded, 'A1/2026', 'ANC review', 'staff-reception', 'MATERNITY', undefined, 'CC-AMARA-2049183');
    const visit = next.visits.find((v) => v.patientId === 'pat-amara' && v.stage !== 'COMPLETED');
    expect(visit?.clinic).toBe('MATERNITY');
    expect(visit?.orders.some((o) => o.serviceId === 'reg-folder' && o.chargeable !== false)).toBe(false);
    expect(visit?.orders.some((o) => o.serviceId === 'reg-review')).toBe(false);
  });

  it('records stay, date of birth, and government or private insurance on a new patient', () => {
    const next = createPatientFolder(createSeedState(), {
      firstName: 'Ama',
      lastName: 'Serwaa',
      dateOfBirth: '1990-04-10',
      gender: 'Female',
      phone: '024 000 1111',
      address: 'House 4, Spintex Road',
      town: 'Accra',
      insuranceType: 'GOVERNMENT',
      insuranceProvider: 'NHIS',
      insuranceNumber: 'NHIS-90001',
      staffId: 'staff-reception',
    });
    const patient = next.patients[0];
    expect(patient?.address).toBe('House 4, Spintex Road');
    expect(patient?.town).toBe('Accra');
    expect(patient?.dateOfBirth).toBe('1990-04-10');
    expect(patient?.insuranceType).toBe('GOVERNMENT');
    expect(patient?.age).toBeGreaterThan(30);
  });

  it('treats a patient with no NHIS or private insurance as a cash private patient', () => {
    const next = createPatientFolder(createSeedState(), {
      firstName: 'Kofi',
      lastName: 'Boateng',
      dateOfBirth: '1988-11-03',
      gender: 'Male',
      phone: '024 222 3333',
      address: 'Madina Estates',
      town: 'Accra',
      insuranceType: 'CASH',
      staffId: 'staff-reception',
    });
    const patient = next.patients[0];
    expect(patient?.insuranceType).toBe('CASH');
    expect(patient?.insuranceNumber).toBeUndefined();
    expect(patient?.insuranceProvider).toBeUndefined();
  });

  it('lets reception allocate a folder number by date so numbers can scale by year', () => {
    const first = allocatePatientFolder(createSeedState(), {
      firstName: 'Akosua',
      lastName: 'Mensah',
      dateOfBirth: '1995-02-01',
      gender: 'Female',
      phone: '024 444 5555',
      address: 'Adenta',
      town: 'Accra',
      insuranceType: 'CASH',
      folderDate: '2026-08-20',
      hospitalNo: '12',
      staffId: 'staff-reception',
    });
    expect('error' in first ? first.error : undefined).toBeUndefined();
    expect('hospitalNo' in first ? first.hospitalNo : undefined).toBe('A12/2026');
    const duplicate = allocatePatientFolder(first.state, {
      firstName: 'Yaw',
      lastName: 'Mensah',
      age: 40,
      gender: 'Male',
      phone: '024 444 5556',
      folderDate: '2026-08-20',
      hospitalNo: '2026/12',
      staffId: 'staff-reception',
    });
    expect('error' in duplicate ? duplicate.error : '').toMatch(/already allocated/i);
    const nextYear = allocatePatientFolder(first.state, {
      firstName: 'Kojo',
      lastName: 'Mensah',
      age: 28,
      gender: 'Male',
      phone: '024 444 5557',
      folderDate: '2027-01-02',
      hospitalNo: '1',
      staffId: 'staff-reception',
    });
    expect('hospitalNo' in nextYear ? nextYear.hospitalNo : undefined).toBe('A1/2027');
  });

  it('attaches a co-payer when opening a new visit', () => {
    const seeded = createSeedState();
    const next = checkInExisting(seeded, 'pat-amara', 'ANC review', 'staff-reception', 'MATERNITY', 'pay-amara-spouse', 'CC-AMARA-2049183');
    const visit = next.visits.find((v) => v.patientId === 'pat-amara' && v.stage !== 'COMPLETED');
    expect(visit?.copayerId).toBe('pay-amara-spouse');
    expect(visit?.clinic).toBe('MATERNITY');
    expect(visit?.nhisCcCode).toBe('CC-AMARA-2049183');
  });

  it('will not check in or bill an NHIS / Ghana Card patient without a CC code', () => {
    const seeded = createSeedState();
    const blocked = checkInExisting(seeded, 'pat-amara', 'ANC review', 'staff-reception', 'MATERNITY');
    expect(blocked.visits.some((v) => v.patientId === 'pat-amara' && v.stage !== 'COMPLETED')).toBe(false);
    const withoutCc = {
      ...seeded,
      visits: seeded.visits.map((visit) => (visit.id === 'vis-nina' ? { ...visit, nhisCcCode: undefined } : visit)),
    };
    const nina = withoutCc.patients.find((p) => p.id === 'pat-nina');
    const ninaVisit = withoutCc.visits.find((v) => v.id === 'vis-nina');
    expect(visitMissingRequiredCc(nina, ninaVisit)).toBe(true);
    const billed = applyVisitBilling(withoutCc, 'vis-nina', {
      billable: true,
      serviceIds: ['reg-folder'],
      staffId: 'staff-reception',
    });
    expect(billed.visits.find((v) => v.id === 'vis-nina')?.billingDecidedAt).toBeUndefined();
  });

  it('lets reception check a patient into the eye clinic', () => {
    const next = registerPatient(createSeedState(), {
      firstName: 'Ama',
      lastName: 'Boateng',
      age: 40,
      gender: 'Female',
      phone: '+1-555-0191',
      reason: 'Blurred vision',
      staffId: 'staff-reception',
      clinic: 'EYE',
    });
    const visit = next.visits[0];
    expect(visit?.clinic).toBe('EYE');
    expect(visit?.stage).toBe('AWAITING_SERVICES');
    expect(visit?.orders.some((o) => o.serviceId === 'eye-consult' && o.status === 'ORDERED' && o.chargeable === false)).toBe(true);
    expect(unpaidOrders(visit!).length).toBe(0);
  });

  it('lets reception bill a visit or waive a worker’s relative', () => {
    const registered = registerPatient(createSeedState(), {
      firstName: 'Ama',
      lastName: 'Boateng',
      age: 40,
      gender: 'Female',
      phone: '+1-555-0191',
      reason: 'Blurred vision',
      staffId: 'staff-reception',
      clinic: 'EYE',
      relatedStaffId: 'staff-nurse',
      staffRelation: 'Child',
    });
    const visitId = registered.visits[0]!.id;
    const billed = applyVisitBilling(registered, visitId, {
      billable: true,
      serviceIds: ['eye-consult'],
      staffId: 'staff-reception',
    });
    expect(unpaidOrders(billed.visits[0]!).some((o) => o.serviceId === 'eye-consult')).toBe(true);
    const waived = applyVisitBilling(registered, visitId, {
      billable: false,
      serviceIds: [],
      waivedReason: 'Child of Mary Nurse',
      staffId: 'staff-reception',
    });
    expect(waived.visits[0]?.billable).toBe(false);
    expect(unpaidOrders(waived.visits[0]!).length).toBe(0);
  });

  it('moves a visit from vitals to the doctor queue', () => {
    const seeded = createSeedState();
    const nina = seeded.visits.find((v) => v.id === 'vis-nina');
    expect(nina?.stage).toBe('CHECKED_IN');
    const withVitals = recordVitals(
      seeded,
      'vis-nina',
      {
        systolicBp: 120,
        diastolicBp: 80,
        temperatureC: 36.8,
        pulseBpm: 72,
        weightKg: 60,
        heightCm: 165,
        spo2: 99,
      },
      'staff-nurse',
    );
    expect(withVitals.visits.find((v) => v.id === 'vis-nina')?.stage).toBe('VITALS_DONE');
    const toDoctor = sendToDoctor(withVitals, 'vis-nina');
    expect(toDoctor.visits.find((v) => v.id === 'vis-nina')?.stage).toBe('WITH_DOCTOR');
  });

  it('does not double-check-in an active visit', () => {
    const seeded = createSeedState();
    const next = checkInExisting(seeded, 'pat-nina', 'Follow-up', 'staff-reception');
    const ninaVisits = next.visits.filter((v) => v.patientId === 'pat-nina' && v.stage !== 'COMPLETED');
    expect(ninaVisits).toHaveLength(1);
  });

  it('creates a staff account', () => {
    const next = createStaff(createSeedState(), {
      email: 'new.nurse@clinic.local',
      firstName: 'Pat',
      lastName: 'Agyei',
      role: 'NURSE',
      password: 'NursePass1!',
    });
    expect(next.staff.some((s) => s.email === 'new.nurse@clinic.local' && s.username === 'new.nurse')).toBe(true);
  });

  it('orders lab work then bills in Ghana cedis', () => {
    const afterPlan = planCare(createSeedState(), 'vis-kwame', {
      diagnosis: 'Hypertension',
      prescription: '',
      notes: 'Chest X-ray and FBC',
      disposition: 'DISCHARGED',
      serviceIds: ['lab-fbc', 'rad-chest'],
    });
    const visit = afterPlan.visits.find((v) => v.id === 'vis-kwame');
    expect(visit?.stage).toBe('AWAITING_SERVICES');
    const fbc = visit?.orders.find((o) => o.serviceId === 'lab-fbc');
    expect(fbc?.status).toBe('ORDERED');
    const afterLab = completeOrder(afterPlan, 'vis-kwame', fbc!.id, 'Hb 13.1 g/dL', [
      { id: 'hb', name: 'Hb', value: '13.1', unit: 'g/dL', flag: '' },
    ]);
    const afterLabVisit = afterLab.visits.find((v) => v.id === 'vis-kwame');
    expect(afterLabVisit?.stage).toBe('WITH_DOCTOR');
    expect(afterLabVisit?.orders.find((o) => o.serviceId === 'lab-fbc')?.needsDoctorReview).toBe(true);
    expect(afterLabVisit?.orders.find((o) => o.serviceId === 'lab-fbc')?.result).toMatch(/Hb 13.1/);
    expect(afterLabVisit?.orders.find((o) => o.serviceId === 'lab-fbc')?.labLines?.[0].name).toBe('Hb');
    const afterReview = planCare(afterLab, 'vis-kwame', {
      diagnosis: 'Hypertension',
      prescription: '',
      notes: 'Reviewed FBC. Await chest X-ray.',
      disposition: 'DISCHARGED',
      serviceIds: [],
    });
    expect(afterReview.visits.find((v) => v.id === 'vis-kwame')?.stage).toBe('AWAITING_SERVICES');
    const xray = afterReview.visits.find((v) => v.id === 'vis-kwame')?.orders.find((o) => o.serviceId === 'rad-chest');
    const billed = completeOrder(afterReview, 'vis-kwame', xray!.id);
    expect(billed.visits.find((v) => v.id === 'vis-kwame')?.stage).toBe('READY_TO_BILL');
    const paid = payBill(billed, 'vis-kwame', 'staff-cashier');
    const done = paid.visits.find((v) => v.id === 'vis-kwame');
    expect(done?.stage).toBe('COMPLETED');
    expect(done?.receiptNo).toMatch(/^RCP-/);
  });

  it('keeps a patient in lab until every lab test on the visit is sent', () => {
    const afterPlan = planCare(createSeedState(), 'vis-kwame', {
      diagnosis: 'Hypertension',
      prescription: '',
      notes: 'FBC and LFT',
      disposition: 'DISCHARGED',
      serviceIds: ['lab-fbc', 'lab-lft'],
    });
    const visit = afterPlan.visits.find((v) => v.id === 'vis-kwame');
    const fbc = visit?.orders.find((o) => o.serviceId === 'lab-fbc');
    const lft = visit?.orders.find((o) => o.serviceId === 'lab-lft');
    const afterOne = completeOrder(afterPlan, 'vis-kwame', fbc!.id, 'Hb 13.1 g/dL', [
      { id: 'hb', name: 'Hb', value: '13.1', unit: 'g/dL', flag: '' },
    ]);
    expect(afterOne.visits.find((v) => v.id === 'vis-kwame')?.stage).toBe('AWAITING_SERVICES');
    const afterBoth = completeOrders(afterOne, 'vis-kwame', [
      {
        orderId: lft!.id,
        result: 'ALP 60.2 U/L H',
        labLines: [{ id: 'alp', name: 'ALP', value: '60.2', unit: 'U/L', flag: 'H' }],
      },
    ]);
    const doneLabs = afterBoth.visits.find((v) => v.id === 'vis-kwame');
    expect(doneLabs?.stage).toBe('WITH_DOCTOR');
    expect(doneLabs?.orders.filter((o) => o.department === 'LAB' && o.status === 'DONE')).toHaveLength(2);
  });

  it('authenticates eye and ENT clinic staff', () => {
    const seeded = createSeedState();
    const eye = authenticateStaff(seeded, 'eye@clinic.local', 'EyeDoc1!');
    const eyeNurse = authenticateStaff(seeded, 'eyenurse@clinic.local', 'EyeNurse1!');
    const ent = authenticateStaff(seeded, 'ent@clinic.local', 'EntDoc1!');
    const entNurse = authenticateStaff(seeded, 'entnurse@clinic.local', 'EntNurse1!');
    expect(eye !== 'invalid' && eye && eye.role).toBe('EYE_DOCTOR');
    expect(eyeNurse !== 'invalid' && eyeNurse && eyeNurse.role).toBe('EYE_NURSE');
    expect(ent !== 'invalid' && ent && ent.role).toBe('ENT_DOCTOR');
    expect(entNurse !== 'invalid' && entNurse && entNurse.role).toBe('ENT_NURSE');
    expect(authenticateStaff(seeded, 'nurse@clinic.local', 'wrong')).toBe('invalid');
    const byName = authenticateStaff(seeded, 'eye', 'EyeDoc1!');
    expect(byName !== 'invalid' && byName && byName.email).toBe('eye@clinic.local');
  });

  it('lets reception collect folder fees without closing the visit', () => {
    const paid = payOrders(createSeedState(), 'vis-nina', ['ord-nina-reg'], 'staff-reception');
    const visit = paid.visits.find((v) => v.id === 'vis-nina');
    expect(visit?.stage).toBe('CHECKED_IN');
    expect(visit?.orders[0]?.paidAt).toBeTruthy();
    expect(visit?.orders[0]?.paidBy).toBe('staff-reception');
  });

  it('looks up a returning patient by hospital number', () => {
    const seeded = createSeedState();
    expect(searchPatients(seeded.patients, 'A2/2026')[0]?.lastName).toBe('Mensah');
    const returned = checkInByHospitalNo(seeded, 'A1/2026', 'ANC review', 'staff-reception', 'GENERAL', undefined, 'CC-AMARA-2049183');
    const open = returned.visits.filter((v) => v.patientId === 'pat-amara' && v.stage !== 'COMPLETED');
    expect(open).toHaveLength(1);
    expect(open[0]?.reason).toBe('ANC review');
  });

  it('keeps hospital numbers in the patient database after a demo reset', () => {
    const registered = registerPatient(createSeedState(), {
      firstName: 'Ada',
      lastName: 'Kofi',
      age: 22,
      gender: 'Female',
      phone: '+1-555-0190',
      reason: 'Headache',
      staffId: 'staff-reception',
    });
    saveCareState(registered);
    const reset = resetCareState();
    const ada = reset.patients.find((p) => p.firstName === 'Ada' && p.lastName === 'Kofi');
    expect(ada?.hospitalNo).toBe(`A6/${new Date().getFullYear()}`);
    expect(new Set(reset.patients.map((p) => p.hospitalNo)).size).toBe(reset.patients.length);
  });
});
