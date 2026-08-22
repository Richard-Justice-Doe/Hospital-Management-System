import { answerClinicQuestion, isClinicOpsQuestion, type AgentMemory, type AgentReply } from './clinicAgent';
import type { CareState } from './types';

const NOTE =
  'This is general information for learning, not a diagnosis or a prescription for a named patient. Follow Ghana STG / facility protocol, and a clinician must assess the person in front of you.';

export const SUGGESTION_BANK = [
  'What is malaria?',
  'Signs of severe malaria',
  'What should I do for a child with fever?',
  'What is hypertension?',
  'Normal adult vital signs',
  'How does NHIS work?',
  'What is antenatal care?',
  'Warning signs in pregnancy',
  'What is diabetes?',
  'How to use ORS',
  'First aid for bleeding',
  'First aid for burns',
  'Signs of a stroke',
  'What is dehydration?',
  'Hand hygiene at the clinic',
  'What is typhoid fever?',
  'What is anemia?',
  'What is asthma?',
  'What is BMI?',
  'When are antibiotics not needed?',
  'What is pneumonia in children?',
  'How does vaccination work?',
  'What is HIV screening?',
  'What is hepatitis B?',
  'How can staff reduce burnout?',
  'How many visits today?',
  'NHIS vs private',
  'Who has an open visit?',
];

type Topic = { keys: string[]; text: string; ask: string[] };

const TOPICS: Topic[] = [
  {
    keys: ['malaria', 'plasmodium', 'mosquito bite fever'],
    text: `Malaria is an infection spread by Anopheles mosquitoes, common in Ghana. Typical features: fever, chills, headache, body pains, sometimes vomiting or diarrhoea. A rapid test or blood film should confirm it — do not treat on guesswork alone.\n\nDanger signs (refer / treat as severe): confusion, repeated vomiting, inability to drink, jaundice, very pale, fast breathing, fits, or not passing urine.\n\nPrevention: insecticide-treated nets, prompt testing, and completing the prescribed ACT if malaria is confirmed.\n\n${NOTE}`,
    ask: ['Signs of severe malaria', 'What should I do for a child with fever?', 'How to use ORS'],
  },
  {
    keys: ['severe malaria'],
    text: `Severe malaria is a medical emergency. Watch for: altered consciousness, convulsions, severe anaemia, jaundice, breathing difficulty, shock, hypoglycaemia, or dark urine. The person needs urgent facility care — IV artesunate (per protocol), glucose check, and supportive care — not home ACT alone.\n\n${NOTE}`,
    ask: ['What is malaria?', 'Normal adult vital signs'],
  },
  {
    keys: ['fever', 'pyrexia', 'high temperature'],
    text: `Fever is a raised body temperature, often from infection. In this clinic, take a full set of vitals, look for focus (chest, urine, wound, ear), and test for malaria in endemic areas. Children: extra concern if under 2 months, stiff neck, rash, not feeding, lethargy, or convulsions — those need urgent review.\n\nDo not give aspirin to children. Fluids matter. Paracetamol can ease discomfort when used per local protocol.\n\n${NOTE}`,
    ask: ['What is malaria?', 'What is dehydration?', 'Normal adult vital signs'],
  },
  {
    keys: ['hypertension', 'high blood pressure', 'high bp'],
    text: `Hypertension is persistently high blood pressure. Adults often have none or only headache. Confirm with repeat readings, correct cuff size, and the person seated and calm. Lifestyle: less salt, activity, healthy weight, stop smoking, limit alcohol. Medicines are long-term when a clinician starts them — do not stop suddenly.\n\nUrgent review: chest pain, sudden weakness, severe headache, or BP crisis with symptoms.\n\n${NOTE}`,
    ask: ['Normal adult vital signs', 'Signs of a stroke', 'What is diabetes?'],
  },
  {
    keys: ['vital signs', 'normal vitals', 'normal adult'],
    text: `Typical resting adult ranges used in many OPD settings (always interpret with the person, age, and pregnancy):\n• Temperature: about 36.1–37.2 °C\n• Pulse: about 60–100 beats/min\n• Respiratory rate: about 12–20 breaths/min\n• SpO2: usually ≥ 95% on air\n• BP: treat 140/90 mmHg or more as high if confirmed, but follow local cut-offs\n\nChildren have faster pulse and breathing — use a paediatric reference.\n\n${NOTE}`,
    ask: ['What is hypertension?', 'What is asthma?', 'Signs of a stroke'],
  },
  {
    keys: ['nhis', 'national health insurance'],
    text: `NHIS (National Health Insurance Scheme) is Ghana’s public health insurance. A valid card can cover an agreed package of OPD and some inpatient care at accredited facilities. It is not cash in the till — reception still records the person as government (NHIS), and claims follow facility process.\n\nPrivate schemes and cash-paying private patients are billed separately.\n\nAsk “How many NHIS visits today?” if you want this hospital’s live count.`,
    ask: ['How many visits today?', 'NHIS vs private', 'What is antenatal care?'],
  },
  {
    keys: ['antenatal', 'anc', 'pregnancy care', 'prenatal'],
    text: `Antenatal care (ANC) is scheduled care in pregnancy: history, BP, weight, fetal heart where available, lab tests, tetanus immunisation, IPTp for malaria, iron/folate, and counselling. Danger signs: bleeding, severe headache, visual change, convulsions, reduced fetal movement, fever, draining liquor, or severe swelling.\n\n${NOTE}`,
    ask: ['Warning signs in pregnancy', 'What is malaria?', 'What is anemia?'],
  },
  {
    keys: ['warning signs in pregnancy', 'danger signs in pregnancy', 'pregnancy danger'],
    text: `Seek urgent maternity care for: vaginal bleeding, severe headache or visual change, fits, fever, severe abdominal pain, draining fluid, reduced or no fetal movement, difficulty breathing, or swelling of face and hands with headache.\n\n${NOTE}`,
    ask: ['What is antenatal care?', 'What is hypertension?'],
  },
  {
    keys: ['diabetes', 'high blood sugar', 'sugar disease'],
    text: `Diabetes means the body cannot keep blood glucose in a healthy range. Symptoms can include thirst, passing a lot of urine, weight loss, tiredness, and infections. Type 2 is common in adults; Type 1 needs insulin. Hypoglycaemia (sweating, confusion, tremor) is an emergency — give sugar if the person is awake, then review.\n\nEducation: meals, activity, foot care, and medicines exactly as prescribed.\n\n${NOTE}`,
    ask: ['What is hypertension?', 'What is BMI?', 'How to use ORS'],
  },
  {
    keys: ['ors', 'oral rehydration', 'rehydration salt'],
    text: `ORS replaces water and salts lost in diarrhoea. Use a standard WHO/UNICEF sachet in the labelled volume of clean water — do not mix “to taste.” Give small frequent sips. Continue feeding, including breast milk. Danger signs: very thirsty, sunken eyes, not passing urine, lethargy, blood in stool, or infant under 2 months — those need clinician review, not ORS alone.\n\n${NOTE}`,
    ask: ['What is dehydration?', 'What should I do for a child with fever?'],
  },
  {
    keys: ['dehydration', 'dehydrated'],
    text: `Dehydration is too little body water, often from diarrhoea, vomiting, or heat. Mild: thirsty, dry mouth. More serious: sunken eyes, reduced urine, fast pulse, delayed skin pinch, lethargy. Treat cause, use ORS if diarrhoea, IV fluids only as a clinician directs.\n\n${NOTE}`,
    ask: ['How to use ORS', 'What is malaria?'],
  },
  {
    keys: ['bleed', 'bleeding', 'haemorrhage', 'hemorrhage'],
    text: `First aid for external bleeding: gloves if available, firm direct pressure with a clean cloth, do not keep peeking, elevate a limb if no fracture is suspected, and get clinical help for spurting blood, amputation, or shock (pale, sweaty, confused, fast pulse). Do not use a tourniquet unless you are trained and it is life-threatening limb bleeding.\n\n${NOTE}`,
    ask: ['First aid for burns', 'Signs of a stroke'],
  },
  {
    keys: ['burn', 'scald'],
    text: `First aid for burns: stop the burning, cool with running water for about 20 minutes, remove tight items, cover with clean non-fluffy cloth. Do not apply toothpaste, oil, or butter. Chemical burns need prolonged irrigation. Large, deep, facial, genital, or child burns need facility care.\n\n${NOTE}`,
    ask: ['First aid for bleeding', 'Hand hygiene at the clinic'],
  },
  {
    keys: ['stroke', 'cva', 'fast campaign'],
    text: `A stroke is a sudden brain blood-flow problem. FAST: Face droop, Arm weakness, Speech difficulty, Time to get emergency care. Also sudden severe headache, vision loss, or imbalance. This is time-critical — do not wait for it to “settle,” and do not give aspirin unless a clinician decides after assessment.\n\n${NOTE}`,
    ask: ['What is hypertension?', 'Normal adult vital signs'],
  },
  {
    keys: ['hand hygiene', 'hand wash', 'wash hands', 'infection prevention'],
    text: `Hand hygiene is the simplest way to stop clinic-acquired infection. Wash with soap and water when hands are dirty or after body fluids; use alcohol rub when hands look clean. Key moments: before touching a patient, before a clean procedure, after body-fluid risk, after touching the patient, after touching surroundings.\n\n${NOTE}`,
    ask: ['When are antibiotics not needed?', 'What is hepatitis B?'],
  },
  {
    keys: ['typhoid', 'enteric fever'],
    text: `Typhoid is a Salmonella Typhi infection spread by contaminated food or water. Features: stepwise fever, headache, abdominal pain, sometimes constipation or diarrhoea. Confirmation needs lab support; Widal alone is often unreliable. Prevention: safe water, food hygiene, sanitation, and vaccination where indicated.\n\n${NOTE}`,
    ask: ['What is malaria?', 'Hand hygiene at the clinic'],
  },
  {
    keys: ['anemia', 'anaemia', 'low blood'],
    text: `Anaemia is a low haemoglobin. People may look pale, feel tired, or breathe fast on exertion. Causes in Ghana include iron deficiency, malaria, sickle cell disease, chronic illness, and blood loss. Treat the cause — iron is not automatic for everyone. Severe pallor, heart failure signs, or very low Hb need urgent care.\n\n${NOTE}`,
    ask: ['What is malaria?', 'What is antenatal care?'],
  },
  {
    keys: ['asthma', 'wheeze', 'inhaler'],
    text: `Asthma is reversible airway narrowing: wheeze, cough, chest tightness, worse at night or with exercise. Reliever inhaler technique matters. Danger: speaking in words only, very fast breathing, silent chest, exhaustion, or low SpO2 — that is an acute attack needing emergency treatment per protocol.\n\n${NOTE}`,
    ask: ['Normal adult vital signs', 'What is pneumonia in children?'],
  },
  {
    keys: ['bmi', 'body mass index'],
    text: `BMI is weight (kg) divided by height (m) squared. Adult bands often used: under 18.5 underweight, 18.5–24.9 healthy, 25–29.9 overweight, 30+ obesity. It does not measure fat directly and is less useful in pregnancy, bodybuilders, or some older adults. Combine with waist and clinical picture.\n\n${NOTE}`,
    ask: ['What is diabetes?', 'What is hypertension?'],
  },
  {
    keys: ['antibiotic', 'antibiotics', 'ampicillin', 'amoxicillin'],
    text: `Antibiotics treat bacterial infections, not viruses like most colds. Using them “just in case” breeds resistance. They should be chosen from local guidelines, at the right dose and duration, after the likely source is considered. Always ask about allergy.\n\n${NOTE}`,
    ask: ['What is malaria?', 'Hand hygiene at the clinic'],
  },
  {
    keys: ['pneumonia', 'chest infection', 'fast breathing child'],
    text: `Pneumonia is infection of the lung. In children, fast breathing, chest indrawing, inability to drink, convulsions, or low SpO2 are danger signs (IMCI). Adults: fever, cough, breathlessness, chest pain. Oxygen, antibiotics when indicated, and malaria testing in endemic areas may all be needed.\n\n${NOTE}`,
    ask: ['What should I do for a child with fever?', 'What is asthma?'],
  },
  {
    keys: ['vaccin', 'immunisation', 'immunization'],
    text: `Vaccines train the immune system to recognise a disease without causing the full illness. They prevent measles, tetanus, hepatitis B, polio, and others on Ghana’s schedule. Mild fever after a jab is common; persistent high fever, difficulty breathing, or collapse needs urgent care.\n\n${NOTE}`,
    ask: ['What is hepatitis B?', 'What is antenatal care?'],
  },
  {
    keys: ['hiv', 'aids'],
    text: `HIV is a virus that weakens immunity if untreated. Screening (with consent and counselling) finds infection early. It is not spread by casual clinic contact. Standard precautions and safe sharps protect staff. Treatment is lifelong ART started by a trained clinician — not a one-off medicine from OPD guesswork.\n\n${NOTE}`,
    ask: ['What is hepatitis B?', 'Hand hygiene at the clinic'],
  },
  {
    keys: ['hepatitis b', 'hepb', 'hep b'],
    text: `Hepatitis B infects the liver and spreads through blood and body fluids, including unsafe injections and from mother to child. Vaccination prevents it. Staff should complete HBV immunisation and never recap needles. Chronic infection needs specialist follow-up, not herbal “liver flushes.”\n\n${NOTE}`,
    ask: ['How does vaccination work?', 'Hand hygiene at the clinic'],
  },
  {
    keys: ['burnout', 'stress at work', 'mental health staff', 'anxiety'],
    text: `Clinic work is demanding. Burnout shows as exhaustion, cynicism, and feeling ineffective. Helpful steps: real breaks, fair rotas, talking to a supervisor or counsellor, sleep, and not carrying every outcome alone. If someone has thoughts of self-harm, they need urgent support — in the US 988 is a crisis line; in Ghana use local emergency / mental health services and stay with the person if it is safe.\n\n${NOTE}`,
    ask: ['Hand hygiene at the clinic', 'Normal adult vital signs'],
  },
  {
    keys: ['first aid'],
    text: `First aid is immediate help before full clinical care: safety of the scene, shout for help, airway and breathing, stop bleeding, cool burns, recovery position if unconscious and breathing, and do not give food or drink if surgery may be needed. You can ask me about bleeding, burns, stroke, fever, or dehydration specifically.`,
    ask: ['First aid for bleeding', 'First aid for burns', 'Signs of a stroke'],
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[?!.]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function mixSuggestions(preferred: string[] = [], question = ''): string[] {
  const extra = SUGGESTION_BANK.filter((item) => !preferred.includes(item) && normalize(item) !== normalize(question));
  const start = question.length % Math.max(1, extra.length);
  const rotated = extra.slice(start).concat(extra.slice(0, start));
  return [...preferred, ...rotated].filter((item, index, all) => all.indexOf(item) === index).slice(0, 8);
}

function withSuggestions(reply: AgentReply, question: string): AgentReply {
  return { ...reply, suggestions: mixSuggestions(reply.suggestions, question) };
}

export function answerHealthQuestion(rawQuestion: string, memory: AgentMemory = {}): AgentReply | null {
  const question = normalize(rawQuestion);
  const ranked = [...TOPICS].sort((a, b) => Math.max(...b.keys.map((k) => k.length)) - Math.max(...a.keys.map((k) => k.length)));
  const topic = ranked.find((item) => item.keys.some((key) => question.includes(key)));
  if (!topic) return null;
  return {
    text: `${topic.text}\n\nWhat else would you like to know?`,
    memory,
    suggestions: mixSuggestions(topic.ask, rawQuestion),
    handled: true,
  };
}

function cleanSearch(rawQuestion: string): string {
  return rawQuestion
    .replace(/[?]+$/g, '')
    .replace(/^(please |can you |could you |i want to know |tell me |explain |define )/i, '')
    .replace(/^(what is|what's|whats|who is|who's|who was|what are|what was|how does|how do|how to|why is|why are|why do)\s+/i, '')
    .trim();
}

export async function lookupWikipedia(rawQuestion: string, fetcher: typeof fetch = fetch): Promise<AgentReply | null> {
  const query = cleanSearch(rawQuestion);
  if (query.length < 3) return null;
  if (/\b(ch-?\d+|0\d{8,})\b/i.test(query)) return null;
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`;
    const searchRes = await fetcher(searchUrl);
    if (!searchRes.ok) return null;
    const searchJson = (await searchRes.json()) as [string, string[], string[], string[]];
    const title = searchJson[1]?.[0];
    const url = searchJson[3]?.[0];
    if (!title) return null;
    const summaryRes = await fetcher(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { 'Api-User-Agent': 'ClinicCMSAssistant/1.0' },
    });
    if (!summaryRes.ok) return null;
    const summary = (await summaryRes.json()) as { extract?: string; title?: string };
    if (!summary.extract) return null;
    const medical = hasAny(normalize(rawQuestion + title), [
      'disease',
      'syndrome',
      'virus',
      'bacteria',
      'cancer',
      'infection',
      'medicine',
      'drug',
      'symptom',
      'therapy',
      'anatomy',
    ]);
    const note = medical ? `\n\n${NOTE}` : '';
    return {
      text: `${summary.title ?? title}\n\n${summary.extract}${note}${url ? `\n\nSource: Wikipedia — ${url}` : ''}\n\nYou can also ask a follow-up, or switch to this hospital’s live counts.`,
      memory: {},
      suggestions: mixSuggestions(['What is malaria?', 'How many visits today?', 'Normal adult vital signs'], rawQuestion),
      handled: true,
    };
  } catch {
    return null;
  }
}

function helpText(): string {
  return [
    'I am a general clinic AI assistant. Ask almost anything — health topics, first aid, how NHIS works, or this hospital’s live visits and bills.',
    '',
    'Health examples: malaria, fever in children, hypertension, ANC danger signs, ORS, stroke, hand hygiene.',
    'Hospital examples: how many visits today, NHIS vs private, find a patient, unpaid bills.',
    'General examples: what is BMI, how vaccination works, or any topic I can look up.',
    '',
    'I will answer automatically. Health answers are for learning, not a diagnosis.',
  ].join('\n');
}

export async function answerAssistantQuestion(
  state: CareState,
  rawQuestion: string,
  memory: AgentMemory = {},
  fetcher: typeof fetch = fetch,
): Promise<AgentReply> {
  const question = normalize(rawQuestion);
  if (!question) {
    return {
      text: 'Ask any health, general, or hospital question — I will answer automatically.',
      memory,
      suggestions: mixSuggestions(),
      handled: true,
    };
  }

  if (hasAny(question, ['help', 'what can you', 'what do you', 'how do you work', 'who are you'])) {
    return { text: helpText(), memory, suggestions: mixSuggestions(), handled: true };
  }

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(question)) {
    return {
      text: 'Hello. Ask about malaria, vitals, pregnancy danger signs, first aid, NHIS, today’s visits, or anything else you want to understand.',
      memory,
      suggestions: mixSuggestions(['What is malaria?', 'Normal adult vital signs', 'How many visits today?']),
      handled: true,
    };
  }

  if (isClinicOpsQuestion(rawQuestion)) {
    const ops = answerClinicQuestion(state, rawQuestion, memory);
    if (ops.handled) return withSuggestions(ops, rawQuestion);
  }

  const health = answerHealthQuestion(rawQuestion, memory);
  if (health) return health;

  const wiki = await lookupWikipedia(rawQuestion, fetcher);
  if (wiki) return wiki;

  return {
    text: `I do not have a packed answer for that yet, but you can ask another way.\n\nTry a health topic (malaria, diabetes, ANC), a general question (what is BMI, what is a stroke), or a hospital count (how many visits today).`,
    memory,
    suggestions: mixSuggestions(['What is malaria?', 'What is hypertension?', 'How many visits today?'], rawQuestion),
    handled: true,
  };
}
