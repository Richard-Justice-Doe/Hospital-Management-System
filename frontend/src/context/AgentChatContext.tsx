import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useCare } from './CareContext';
import { answerAssistantQuestion, mixSuggestions } from '../workflow/assistantKnowledge';
import { clearAssistantHistory } from '../workflow/assistantSession';
import type { AgentMemory } from '../workflow/clinicAgent';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  text: 'Ask about health topics, first aid, NHIS, or today’s visits and bills.',
};

const STARTER_SUGGESTIONS = mixSuggestions([
  'What is malaria?',
  'Normal adult vital signs',
  'How many visits today?',
  'First aid for bleeding',
]);

interface AgentChatValue {
  messages: ChatMessage[];
  suggestions: string[];
  pending: boolean;
  ask: (question: string) => void;
}

const AgentChatContext = createContext<AgentChatValue | null>(null);

export function AgentChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { state } = useCare();
  const userId = user?.id ?? '';
  const [ownerId, setOwnerId] = useState(userId);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [memory, setMemory] = useState<AgentMemory>({});
  const [suggestions, setSuggestions] = useState<string[]>(STARTER_SUGGESTIONS);
  const [pending, setPending] = useState(false);

  const resetChat = useCallback(() => {
    setMessages([WELCOME]);
    setMemory({});
    setSuggestions(STARTER_SUGGESTIONS);
    setPending(false);
  }, []);

  useEffect(() => {
    if (userId !== ownerId) {
      resetChat();
      setOwnerId(userId);
    }
  }, [userId, ownerId, resetChat]);

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text || pending || !userId) return;
      setPending(true);
      void answerAssistantQuestion(state, text, memory)
        .then((reply) => {
          setMemory(reply.memory);
          setSuggestions(reply.suggestions);
          setMessages((current) => [...current, { role: 'user', text }, { role: 'assistant', text: reply.text }]);
        })
        .finally(() => setPending(false));
    },
    [memory, pending, state, userId],
  );

  const value = useMemo(
    () => ({ messages, suggestions, pending, ask }),
    [messages, suggestions, pending, ask],
  );

  return <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>;
}

export function useAgentChat(): AgentChatValue {
  const ctx = useContext(AgentChatContext);
  if (!ctx) throw new Error('useAgentChat must be used within AgentChatProvider');
  return ctx;
}

export { clearAssistantHistory, WELCOME };
