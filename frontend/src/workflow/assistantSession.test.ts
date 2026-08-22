import { describe, expect, it } from 'vitest';
import { clearAssistantHistory } from './assistantSession';

describe('assistant session privacy', () => {
  it('deletes stored assistant questions', () => {
    sessionStorage.setItem('cms_clinic_agent_v1', '{"messages":[{"role":"user","text":"secret"}]}');
    sessionStorage.setItem('cms_clinic_agent_staff-nurse', '{"messages":[]}');
    localStorage.setItem('cms_clinic_agent_v1', '{"messages":[{"role":"user","text":"secret"}]}');
    sessionStorage.setItem('unrelated', 'keep');

    clearAssistantHistory();

    expect(sessionStorage.getItem('cms_clinic_agent_v1')).toBeNull();
    expect(sessionStorage.getItem('cms_clinic_agent_staff-nurse')).toBeNull();
    expect(localStorage.getItem('cms_clinic_agent_v1')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });
});
