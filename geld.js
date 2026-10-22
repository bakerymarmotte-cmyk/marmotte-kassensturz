// ==========================================================================
// Geld-Hilfen: Stückelung, Rechnen und Formatieren
// Alle Beträge werden intern in RAPPEN als ganze Zahlen gerechnet
// (100.– = 10000 Rappen). So entstehen keine Rundungsfehler.
// ==========================================================================

// Achtung: Wird hier eine Stückelung ergänzt, muss sie auch in firestore.rules
// (Funktion summeOk) ergänzt werden, sonst lehnt die Datenbank das Speichern ab.
export const NOTEN = [
  { key: "10000", label: "100.–" },
  { key: "5000",  label: "50.–" },
  { key: "2000",  label: "20.–" },
  { key: "1000",  label: "10.–" },
];
export const MUENZEN = [
  { key: "500", label: "5.–" },
  { key: "200", label: "2.–" },
  { key: "100", label: "1.–" },
  { key: "50",  label: "0.50" },
  { key: "20",  label: "0.20" },
  { key: "10",  label: "0.10" },
  { key: "5",   label: "0.05" },
];
export const ALLE = [...NOTEN, ...MUENZEN];

/** Leeres Zähl-Objekt: { "10000": 0, "5000": 0, ... } */
export function leereAnzahl() {
  return Object.fromEntries(ALLE.map((s) => [s.key, 0]));
}

/** Total in Rappen aus einem Zähl-Objekt */
export function total(anzahl) {
  return ALLE.reduce((sum, s) => sum + (anzahl[s.key] || 0) * Number(s.key), 0);
}

const fmt = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123450 → "1’234.50" */
export function chf(rappen) {
  return fmt.format((rappen || 0) / 100);
}

/** Differenz mit Vorzeichen: +12.50 / −3.00 / ±0.00 */
export function chfDiff(rappen) {
  if (rappen > 0) return "+" + chf(rappen);
  if (rappen < 0) return "−" + chf(-rappen);
  return "±" + chf(0);
}

/** Eingabe "1'250.50" oder "1250,5" → 125050 Rappen (oder null bei ungültig) */
export function parseChf(text) {
  const clean = String(text).trim().replace(/['’\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function datumZeit(ts) {
  const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
  if (!d) return "–";
  return d.toLocaleString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
