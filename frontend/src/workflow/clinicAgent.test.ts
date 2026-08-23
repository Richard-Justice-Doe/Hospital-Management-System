import { describe, expect, it } from 'vitest';
import { answerAssistantQuestion, answerHealthQuestion } from './assistantKnowledge';
import { answerClinicQuestion, isClinicOpsQuestion } from './clinicAgent';
import { buildDashboardSnapshot } from './dashboard';
import { createSeedState } from './seed';

describe('clinic AI agent', () => {
  const state = createSeedState();
  const all = buildDashboardSnapshot(state, 'all');

  it('answers visit totals from live records', () => {
    const reply = answerClinicQuestion(state, 'How many visits all time?');
    expect(reply.handled).toBe(true);
    expect(reply.text).toContain(`${all.hospital.visits} visits`);
    expect(reply.text).toMatch(/NHIS/);
  });

  it('answers NHIS versus private', () => {
    const reply = answerClinicQuestion(state, 'NHIS vs private all time');
    expect(reply.handled).toBe(true);
    expect(reply.text).toContain(`${all.hospital.nhis} NHIS`);
    expect(reply.text).toContain(`${all.hospital.private} private`);
  });

  it('finds a patient by name', () => {
    const reply = answerClinicQuestion(state, 'Find patient Amara');
    expect(reply.text).toMatch(/Amara Owusu/);
    expect(reply.text).toMatch(/A1\/2026/);
  });

  it('lists open visits', () => {
    const reply = answerClinicQuestion(state, 'Who has an open visit?');
    expect(reply.text).toMatch(/open visit/i);
  });

  it('does not treat general health questions as hospital counts', () => {
    expect(isClinicOpsQuestion('What is malaria?')).toBe(false);
    expect(isClinicOpsQuestion('How does NHIS work?')).toBe(false);
  });

  it('answers health questions without clinic records', () => {
    const reply = answerHealthQuestion('What is malaria?');
    expect(reply?.text).toMatch(/mosquito/i);
    expect(reply?.text).toMatch(/not a diagnosis/i);
  });

  it('explains how to get help', async () => {
    const reply = await answerAssistantQuestion(state, 'help');
    expect(reply.text).toMatch(/general clinic AI assistant/i);
    expect(reply.text).toMatch(/health/i);
  });
});
