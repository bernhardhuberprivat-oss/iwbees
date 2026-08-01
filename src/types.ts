export interface Entry {
  id: number;
  hive: number;
  entry_date: string;
  notes: string | null;
  queen_color: string | null;
  queen_year: number | null;
  colony_strength: string | null;
  varroa: string | null;
  feeding: string | null;
  honey_harvest_kg: string | null;
  weight_kg: string | null;
  sighting_queen: boolean | null;
  sighting_larvae: boolean | null;
  sighting_eggs: boolean | null;
  sighting_brood: boolean | null;
  occupied_combs: number | null;
  queen_cells: number | null;
  varroa_mites: boolean | null;
  photo_keys: string[];
  created_at: string;
  pending?: boolean;
  localPhotoUrls?: string[];
}

export interface HiveInfo {
  color?: string | null;
  name?: string | null;
  category?: string | null;
  queenYear?: number | null;
  colonyStrength?: string | null;
  weightKg?: number | null;
  sightingQueen?: boolean | null;
  sightingLarvae?: boolean | null;
  sightingEggs?: boolean | null;
  sightingBrood?: boolean | null;
  occupiedCombs?: number | null;
  queenCells?: number | null;
  varroaMites?: boolean | null;
}

// Kategorie des Bienenvolks im jeweiligen Stock.
export const HIVE_CATEGORIES = ["Wirtschaftsvolk", "Ableger", "Schwarm", "Zuchtvolk", "Sonstiges"];

export const HIVES = Array.from({ length: 10 }, (_, i) => i + 1);

export const COLOR_PALETTE = [
  { name: "Blau", value: "#2980b9" },
  { name: "Weiß", value: "#ffffff" },
  { name: "Hellblau", value: "#5dade2" },
  { name: "Grün", value: "#27ae60" },
  { name: "Rot", value: "#e74c3c" },
  { name: "Gelb", value: "#f1c40f" },
];

// Internationale Bienenköniginnen-Zeichenfarben nach Jahresendziffer (Weltbienenzuchtverband-Code):
// Jahre auf 1/6 -> Weiß, 2/7 -> Gelb, 3/8 -> Rot, 4/9 -> Grün, 5/0 -> Blau
const QUEEN_YEAR_COLORS: Record<number, { name: string; hex: string }> = {
  1: { name: "Weiß", hex: "#ffffff" },
  6: { name: "Weiß", hex: "#ffffff" },
  2: { name: "Gelb", hex: "#f1c40f" },
  7: { name: "Gelb", hex: "#f1c40f" },
  3: { name: "Rot", hex: "#e74c3c" },
  8: { name: "Rot", hex: "#e74c3c" },
  4: { name: "Grün", hex: "#27ae60" },
  9: { name: "Grün", hex: "#27ae60" },
  5: { name: "Blau", hex: "#2980b9" },
  0: { name: "Blau", hex: "#2980b9" },
};

// Ermittelt automatisch die Markierungsfarbe der Königin aus ihrem Zuchtjahr.
export function getQueenColorForYear(year: number | null | undefined): { name: string; hex: string } | null {
  if (!year || Number.isNaN(year)) return null;
  const lastDigit = Math.abs(Math.trunc(year)) % 10;
  return QUEEN_YEAR_COLORS[lastDigit] ?? null;
}
