import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { deskText, speakDesk, type DeskLang } from '../workflow/deskUi';

interface DeskValue {
  lang: DeskLang;
  setLang: (lang: DeskLang) => void;
  hugeType: boolean;
  setHugeType: (on: boolean) => void;
  voiceOn: boolean;
  setVoiceOn: (on: boolean) => void;
  training: boolean;
  setTraining: (on: boolean) => void;
  calling: { name: string; place: string } | null;
  callNext: (name: string, place: string) => void;
  clearCall: () => void;
  t: (key: string) => string;
  speak: (text: string) => void;
}

const DeskContext = createContext<DeskValue | null>(null);

export function DeskProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<DeskLang>(() => (localStorage.getItem('cms_lang') as DeskLang) || 'en');
  const [hugeType, setHugeType] = useState(() => localStorage.getItem('cms_huge') === '1');
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem('cms_voice') === '1');
  const [training, setTraining] = useState(() => localStorage.getItem('cms_train') === '1');
  const [calling, setCalling] = useState<{ name: string; place: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('cms_lang', lang);
    localStorage.setItem('cms_huge', hugeType ? '1' : '0');
    localStorage.setItem('cms_voice', voiceOn ? '1' : '0');
    localStorage.setItem('cms_train', training ? '1' : '0');
    document.documentElement.style.fontSize = hugeType ? '20px' : '';
  }, [lang, hugeType, voiceOn, training]);

  const value = useMemo<DeskValue>(
    () => ({
      lang,
      setLang,
      hugeType,
      setHugeType,
      voiceOn,
      setVoiceOn,
      training,
      setTraining,
      calling,
      callNext: (name, place) => {
        setCalling({ name, place });
        if (voiceOn) speakDesk(`Next patient. ${name}. ${place}`);
      },
      clearCall: () => setCalling(null),
      t: (key) => deskText(lang, key),
      speak: (text) => {
        if (voiceOn) speakDesk(text);
      },
    }),
    [lang, hugeType, voiceOn, training, calling],
  );

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk() {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error('useDesk must be used within DeskProvider');
  return ctx;
}
