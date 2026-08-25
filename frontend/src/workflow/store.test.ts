import { evaluateVitals } from './vitals';
import { describe, expect, it } from 'vitest';
import { allocatePatientFolder, applyVisitBilling, appendBillLines, checkInByHospitalNo, checkInExisting, completeOrder, completeOrders, createPatientFolder, createStaff, payBill, payOrders, planCare, recordVitals, registerPatient, resetCareState, saveCareState, savePatientCheckIn, searchPatients, sendToDoctor, authenticateStaff, updatePatientFolder, upsertCopayer } from './store';
import { visitMissingRequiredCc } from './patientAdmin';
import { claimQueue, claimSchemeOf } from './supportDesks';
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
    expect(next.patients[0]?.nextOfKin).toBeUndefined();
    expect(next.visits.some((v) => v.patientId === next.patients[0]?.id)).toBe(false);
  });

  it('stores next of kin, estimated age, and registration clinic on a new folder', () => {
    const next = createPatientFolder(createSeedState(), {
      firstName: 'Akua',
      lastName: 'Boateng',
      age: 40,
      ageEstimated: true,
      gender: 'Female',
      phone: '024 777 0101',
      address: 'House 3',
      hometown: 'Techiman',
      nextOfKinName: 'Kofi Boateng',
      nextOfKinRelationship: 'Spouse',
      nextOfKinPhone: '024 777 0102',
      preferredPayment: 'NHIS',
      insuranceType: 'GOVERNMENT',
      ghanaCardNo: 'GHA-777010101-1',
      insuranceNumber: 'NHIS-777',
      registrationVisitType: 'WALK_IN',
      registeredClinic: 'GENERAL',
      consentTreatment: true,
      bloodGroup: 'O+',
      knownAllergies: 'Penicillin',
      staffId: 'staff-reception',
    });
    const patient = next.patients[0];
    expect(patient?.ageEstimated).toBe(true);
    expect(patient?.age).toBe(40);
    expect(patient?.nextOfKin?.name).toBe('Kofi Boateng');
    expect(patient?.registeredClinic).toBe('GENERAL');
    expect(patient?.bloodGroup).toBe('O+');
    expect(patient?.consentTreatment).toBe(true);
    expect(next.visits.some((v) => v.patientId === patient?.id)).toBe(false);
  });

  it('does not bill a second folder when a returning patient is checked in', () => {
    const seeded = createSeedState();
    const next = checkInByHospitalNo(seeded, 'A1/2026', 'ANC review', 'staff-reception', 'MATERNITY', undefined, '20491');
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

  it('saves government or private insurance on a co-payer', () => {
    const withNhiss = upsertCopayer(createSeedState(), {
      patientId: 'pat-amara',
      firstName: 'Abena',
      lastName: 'Owusu',
      relationship: 'Parent',
      phone: '024 111 0188',
      isPrimary: false,
      insuranceType: 'GOVERNMENT',
      insuranceNumber: 'NHIS-ABENA-11',
      ghanaCardNo: 'GHA-111222333-1',
    });
    const nhis = withNhiss.copayers.find((c) => c.firstName === 'Abena');
    expect(nhis?.insuranceType).toBe('GOVERNMENT');
    expect(nhis?.insuranceProvider).toBe('NHIS');
    expect(nhis?.ghanaCardNo).toBe('GHA-111222333-1');

    const withPrivate = upsertCopayer(createSeedState(), {
      patientId: 'pat-lisa',
      firstName: 'Acacia',
      lastName: 'Health',
      relationship: 'Employer',
      phone: '030 200 0100',
      isPrimary: false,
      insuranceType: 'PRIVATE',
      insuranceProvider: 'Acacia Health',
      insuranceNumber: 'ACA-LISA-99',
    });
    const policy = withPrivate.copayers.find((c) => c.relationship === 'Employer');
    expect(policy?.insuranceType).toBe('PRIVATE');
    expect(policy?.insuranceProvider).toBe('Acacia Health');
    expect(policy?.insuranceNumber).toBe('ACA-LISA-99');
  });

  it('attaches a co-payer when opening a new visit', () => {
    const seeded = createSeedState();
    const next = checkInExisting(seeded, 'pat-amara', 'ANC review', 'staff-reception', 'MATERNITY', 'pay-amara-spouse', '20491');
    const visit = next.visits.find((v) => v.patientId === 'pat-amara' && v.stage !== 'COMPLETED');
    expect(visit?.copayerId).toBe('pay-amara-spouse');
    expect(visit?.clinic).toBe('MATERNITY');
    expect(visit?.nhisCcCode).toBe('20491');
  });

  it('stores a new CC code on each visit and does not reuse the last one', () => {
    const seeded = createSeedState();
    const closed = {
      ...seeded,
      visits: seeded.visits.map((visit) =>
        visit.patientId === 'pat-amara' ? { ...visit, stage: 'COMPLETED' as const, completedAt: new Date().toISOString() } : visit,
      ),
    };
    const blocked = checkInExisting(closed, 'pat-amara', 'ANC review', 'staff-reception', 'MATERNITY');
    expect(blocked.visits.some((visit) => visit.patientId === 'pat-amara' && visit.stage !== 'COMPLETED')).toBe(false);
    const tooLong = checkInExisting(closed, 'pat-amara', 'ANC review', 'staff-reception', 'MATERNITY', undefined, '204918');
    expect(tooLong.visits.some((visit) => visit.patientId === 'pat-amara' && visit.stage !== 'COMPLETED')).toBe(false);
    const next = checkInExisting(closed, 'pat-amara', 'ANC review', 'staff-reception', 'MATERNITY', undefined, '99110');
    const open = next.visits.find((visit) => visit.patientId === 'pat-amara' && visit.stage !== 'COMPLETED');
    const previous = next.visits.find((visit) => visit.id === 'vis-amara');
    expect(open?.id).not.toBe('vis-amara');
    expect(open?.nhisCcCode).toBe('99110');
    expect(previous?.nhisCcCode).toBe('20491');
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
    const returned = checkInByHospitalNo(seeded, 'A1/2026', 'ANC review', 'staff-reception', 'GENERAL', undefined, '20491');
    const open = returned.visits.filter((v) => v.patientId === 'pat-amara' && v.stage !== 'COMPLETED');
    expect(open).toHaveLength(1);
    expect(open[0]?.reason).toBe('ANC review');
  });

  it('saves private insurance on the folder and finds it by phone, name, or folder number if the card is missing', () => {
    const next = createPatientFolder(createSeedState(), {
      firstName: 'Efua',
      lastName: 'Sarpong',
      age: 29,
      gender: 'Female',
      phone: '024 888 0101',
      address: 'Dansoman',
      town: 'Accra',
      preferredPayment: 'PRIVATE',
      insuranceType: 'PRIVATE',
      insuranceProvider: 'Acacia Health',
      insuranceNumber: 'AH-99001',
      staffId: 'staff-reception',
    });
    const patient = next.patients[0];
    expect(patient?.insuranceProvider).toBe('Acacia Health');
    expect(patient?.insuranceNumber).toBe('AH-99001');
    expect(searchPatients(next.patients, '0248880101')[0]?.insuranceNumber).toBe('AH-99001');
    expect(searchPatients(next.patients, 'Sarpong')[0]?.insuranceProvider).toBe('Acacia Health');
    expect(searchPatients(next.patients, patient?.hospitalNo ?? '')[0]?.id).toBe(patient?.id);
    expect(searchPatients(next.patients, 'AH-99001')[0]?.lastName).toBe('Sarpong');
  });

  it('updates a saved folder without changing the hospital number', () => {
    const created = createPatientFolder(createSeedState(), {
      firstName: 'Nana',
      lastName: 'Boateng',
      age: 41,
      gender: 'Male',
      phone: '024 111 2222',
      address: 'Kaneshie',
      town: 'Accra',
      nextOfKinName: 'Ama Boateng',
      nextOfKinPhone: '024 333 4444',
      nextOfKinRelation: 'Wife',
      consentTreatment: true,
      preferredPayment: 'NHIS',
      insuranceType: 'NHIS',
      insuranceNumber: 'HIN-OLD',
      staffId: 'staff-reception',
    });
    const patient = created.patients[0];
    const hospitalNo = patient?.hospitalNo;
    const updated = updatePatientFolder(created, patient!.id, {
      firstName: 'Nana Yaw',
      lastName: 'Boateng',
      age: 42,
      gender: 'Male',
      phone: '024 999 8888',
      address: 'Kaneshie Extension',
      town: 'Accra',
      nextOfKinName: 'Ama Boateng',
      nextOfKinPhone: '024 333 4444',
      nextOfKinRelation: 'Wife',
      consentTreatment: true,
      preferredPayment: 'NHIS',
      insuranceType: 'NHIS',
      insuranceNumber: 'HIN-NEW',
      staffId: 'staff-reception',
    });
    const saved = updated.state.patients.find((p) => p.id === patient?.id);
    expect(updated.error).toBeUndefined();
    expect(saved?.hospitalNo).toBe(hospitalNo);
    expect(saved?.firstName).toBe('Nana Yaw');
    expect(saved?.age).toBe(42);
    expect(saved?.phone).toBe('024 999 8888');
    expect(saved?.insuranceNumber).toBe('HIN-NEW');
    expect(saved?.address).toBe('Kaneshie Extension');
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

  it('lets the cash unit add quantity lines to a visit bill', () => {
    const next = appendBillLines(createSeedState(), 'vis-nina', [{ serviceId: 'lab-fbc', qty: 2 }]);
    const visit = next.visits.find((item) => item.id === 'vis-nina');
    const line = visit?.orders.find((order) => order.serviceId === 'lab-fbc');
    expect(line?.qty).toBe(2);
    expect(line?.unitPriceGhs).toBe(60);
    expect(line?.priceGhs).toBe(120);
    expect(visit?.orders.filter((order) => order.serviceId === 'reg-folder').length).toBe(1);
  });

  it('checks a patient in and appends billed items in one save', () => {
    const next = savePatientCheckIn(createSeedState(), {
      patientId: 'pat-amara',
      staffId: 'staff-reception',
      clinic: 'GENERAL',
      nhisCcCode: '55110',
      lines: [{ serviceId: 'opd-general', qty: 1 }],
    });
    const visit = next.visits.find((item) => item.patientId === 'pat-amara' && item.stage !== 'COMPLETED');
    expect(visit?.clinic).toBe('GENERAL');
    expect(visit?.nhisCcCode).toBe('55110');
    expect(visit?.billable).toBe(true);
    expect(visit?.orders.some((order) => order.serviceId === 'opd-general' && order.qty === 1)).toBe(true);
    expect(visit?.stage).toBe('CHECKED_IN');
  });

  it('does not check the same person in twice on the same day', () => {
    const seeded = createSeedState();
    const next = savePatientCheckIn(seeded, {
      patientId: 'pat-nina',
      staffId: 'staff-reception',
      clinic: 'GENERAL',
      nhisCcCode: '55110',
      lines: [{ serviceId: 'opd-general', qty: 1 }],
    });
    expect(next.visits.filter((item) => item.patientId === 'pat-nina')).toHaveLength(1);
    expect(next.visits.find((item) => item.id === 'vis-nina')?.orders.some((order) => order.serviceId === 'opd-general')).toBe(false);
  });

  it('checks an expired NHIS folder in as private without a CC code', () => {
    const seeded = createSeedState();
    const expired = {
      ...seeded,
      patients: seeded.patients.map((person) =>
        person.id === 'pat-amara' ? { ...person, nhisExpires: '2025-01-01', nhisStatus: 'EXPIRED' as const } : person,
      ),
    };
    const blocked = savePatientCheckIn(expired, {
      patientId: 'pat-amara',
      staffId: 'staff-reception',
      clinic: 'GENERAL',
      lines: [],
    });
    expect(blocked.visits.some((item) => item.patientId === 'pat-amara' && item.stage !== 'COMPLETED')).toBe(false);

    const next = savePatientCheckIn(expired, {
      patientId: 'pat-amara',
      staffId: 'staff-reception',
      clinic: 'GENERAL',
      coverAsPrivate: true,
      lines: [{ serviceId: 'opd-general', qty: 1 }],
    });
    const visit = next.visits.find((item) => item.patientId === 'pat-amara' && item.stage !== 'COMPLETED');
    const person = next.patients.find((item) => item.id === 'pat-amara');
    expect(visit?.coverAsPrivate).toBe(true);
    expect(visit?.nhisCcCode).toBeUndefined();
    expect(visit?.billable).toBe(true);
    expect(person?.insuranceType).toBe('GOVERNMENT');
    expect(claimSchemeOf(person, visit)).toBeUndefined();
    expect(claimQueue(next).some((row) => row.visit.id === visit?.id)).toBe(false);
  });
});
