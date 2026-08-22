/** A ticket exactly as the MyCluj endpoint returns it — every field is a string. */
export interface RawTicket {
  ticketnumber: string;
  titlu: string;
  description: string;
  isedited: string;
  category: string;
  categoryid: string;
  latitude: string;
  longitude: string;
  /** "DD/MM/YYYY HH:mm:ss" */
  createdon: string;
  /** "O|In lucru", "C|Favorabil", ... — pipe-separated state code and label. */
  status: string;
  resolvereason: string;
}

export type IncidentState = 'A' | 'O' | 'C';

export interface QueryWindow {
  /** Inclusive, YYYY-MM-DD. */
  from: string;
  /** Inclusive, YYYY-MM-DD. */
  to: string;
}

/** The 16 categories the platform exposes. Ids are stable and used by `categorycodelist`. */
export const CATEGORIES: Record<number, string> = {
  1: 'Asistență socială',
  2: 'Depozitări deşeuri',
  3: 'Construcții/lucrări neautorizate; organizare şantier',
  4: 'Iluminat public',
  5: 'Parcări/Parking-uri',
  6: 'Persoane fără adăpost sau care apelează la mila publicului',
  7: 'Salubritate',
  8: 'Spații verzi/Parcuri',
  9: 'Străzi/Alei/Trotuare/Poduri',
  10: 'Taxe și impozite',
  11: 'Semnalizare rutieră',
  12: 'Tulburarea liniștii publice',
  13: 'Altele',
  14: 'Rețele de apă/canalizare (CAS)',
  15: 'Transport public (CTP)',
  16: 'Parcări neregulamentare',
};

/** Earliest date with any data. Verified by probing: 2016 and earlier return empty. */
export const DATA_FLOOR = '2017-03-01';

/**
 * The server returns at most this many records, selected as the FIRST 1500 by
 * ascending date from `incidentfromdate` — then re-sorted by latitude for output.
 * It does NOT signal truncation, so any window returning exactly this many
 * records must be treated as incomplete.
 */
export const RESULT_CAP = 1500;
