/** The 16 upstream categories, with colours used consistently across map and charts. */
export const CATEGORIES: { id: number; name: string; short: string; color: string }[] = [
  { id: 16, name: 'Parcări neregulamentare', short: 'Parcări neregul.', color: '#d94f4f' },
  { id: 9,  name: 'Străzi/Alei/Trotuare/Poduri', short: 'Străzi/Trotuare', color: '#c2751f' },
  { id: 8,  name: 'Spații verzi/Parcuri', short: 'Spații verzi', color: '#3f9142' },
  { id: 13, name: 'Altele', short: 'Altele', color: '#8a8a8a' },
  { id: 7,  name: 'Salubritate', short: 'Salubritate', color: '#7b5ea7' },
  { id: 11, name: 'Semnalizare rutieră', short: 'Semnalizare', color: '#b8933a' },
  { id: 5,  name: 'Parcări/Parking-uri', short: 'Parcări', color: '#c76b9a' },
  { id: 4,  name: 'Iluminat public', short: 'Iluminat', color: '#d9a441' },
  { id: 2,  name: 'Depozitări deşeuri', short: 'Deșeuri', color: '#6b4f3a' },
  { id: 3,  name: 'Construcții neautorizate', short: 'Construcții', color: '#4a6fa5' },
  { id: 15, name: 'Transport public (CTP)', short: 'Transport (CTP)', color: '#2f8f9d' },
  { id: 14, name: 'Rețele apă/canalizare (CAS)', short: 'Apă/canal (CAS)', color: '#3d7ea6' },
  { id: 12, name: 'Tulburarea liniștii publice', short: 'Liniște publică', color: '#9c6b4f' },
  { id: 1,  name: 'Asistență socială', short: 'Asistență socială', color: '#a05252' },
  { id: 10, name: 'Taxe și impozite', short: 'Taxe', color: '#6f7f52' },
  { id: 6,  name: 'Persoane fără adăpost', short: 'Fără adăpost', color: '#8f7a5c' },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Outcome labels, ordered from most to least favourable to the reporter. */
export const OUTCOMES = [
  'Favorabil',
  'Partial',
  'Transferata operatorului',
  'Nefavorabil',
  'Respinsa',
] as const;

export const OUTCOME_LABEL: Record<string, string> = {
  Favorabil: 'Favorabil',
  Partial: 'Parțial',
  'Transferata operatorului': 'Transferată operatorului',
  Nefavorabil: 'Nefavorabil',
  Respinsa: 'Respinsă',
  'In lucru': 'În lucru',
  Noua: 'Nouă',
};

export const CLUJ_CENTER: [number, number] = [23.5899, 46.7712];
export const CLUJ_BOUNDS: [[number, number], [number, number]] = [
  [23.45, 46.68],
  [23.72, 46.85],
];
