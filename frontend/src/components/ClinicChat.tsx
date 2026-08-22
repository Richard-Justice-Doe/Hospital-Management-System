import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAgentChat } from '../context/AgentChatContext';

export default function ClinicChat({ compact = false }: { compact?: boolean }) {
  const { messages, suggestions, pending, ask } = useAgentChat();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, pending]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    ask(text);
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-[28rem]' : 'h-[min(70vh,40rem)]'}`}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                message.role === 'user' ? 'bg-clinic-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {pending && <p className="text-xs text-slate-500">Answering…</p>}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => ask(item)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-clinic-300 hover:bg-clinic-50"
          >
            {item}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about health, first aid, NHIS, visits, or anything else"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-clinic-500"
          aria-label="Ask the AI assistant"
        />
        <button type="submit" disabled={pending || !draft.trim()} className="rounded-lg bg-clinic-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Ask
        </button>
      </form>
    </div>
  );
}
