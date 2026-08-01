// Offline-Warteschlange: neue Einträge werden hier zwischengespeichert (IndexedDB),
// wenn kein Netz da ist, und automatisch hochgeladen, sobald wieder online.

const DB_NAME = "bienentagebuch";
const DB_VERSION = 1;
const STORE = "pendingEntries";

export interface PendingPhoto {
  name: string;
  type: string;
  blob: Blob;
}

export interface PendingEntry {
  localId?: number;
  userId: number;
  hive: number;
  entryDate: string;
  notes: string;
  queenColor: string | null;
  queenYear: number | null;
  colonyStrength: string;
  varroa: string;
  feeding: string;
  weightKg: string;
  sightingQueen: boolean;
  sightingLarvae: boolean;
  sightingEggs: boolean;
  sightingBrood: boolean;
  occupiedCombs: string;
  queenCells: string;
  varroaMites: "" | "ja" | "nein";
  photos: PendingPhoto[];
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addPendingEntry(entry: Omit<PendingEntry, "localId" | "createdAt">): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add({ ...entry, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingEntries(userId?: number): Promise<PendingEntry[]> {
  const db = await openDb();
  const all = await new Promise<PendingEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingEntry[]);
    req.onerror = () => reject(req.error);
  });
  return userId ? all.filter((e) => e.userId === userId) : all;
}

export async function deletePendingEntry(localId: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updatePendingEntryFields(
  localId: number,
  fields: Partial<
    Pick<
      PendingEntry,
      | "entryDate"
      | "notes"
      | "queenColor"
      | "queenYear"
      | "colonyStrength"
      | "varroa"
      | "feeding"
      | "weightKg"
      | "sightingQueen"
      | "sightingLarvae"
      | "sightingEggs"
      | "sightingBrood"
      | "occupiedCombs"
      | "queenCells"
      | "varroaMites"
    >
  >,
  keepPhotoIndices: number[],
  newPhotos: PendingPhoto[]
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const existing = getReq.result as PendingEntry | undefined;
      if (!existing) {
        resolve();
        return;
      }
      const keptPhotos = existing.photos.filter((_, i) => keepPhotoIndices.includes(i));
      const updated: PendingEntry = {
        ...existing,
        ...fields,
        photos: [...keptPhotos, ...newPhotos],
      };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

function buildFormData(entry: PendingEntry): FormData {
  const form = new FormData();
  form.set("userId", String(entry.userId));
  form.set("hive", String(entry.hive));
  form.set("entryDate", entry.entryDate);
  form.set("notes", entry.notes);
  form.set("queenColor", entry.queenColor || "");
  form.set("queenYear", entry.queenYear ? String(entry.queenYear) : "");
  form.set("colonyStrength", entry.colonyStrength);
  form.set("varroa", entry.varroa);
  form.set("feeding", entry.feeding);
  if (entry.weightKg) form.set("weightKg", entry.weightKg);
  form.set("sightingQueen", String(entry.sightingQueen));
  form.set("sightingLarvae", String(entry.sightingLarvae));
  form.set("sightingEggs", String(entry.sightingEggs));
  form.set("sightingBrood", String(entry.sightingBrood));
  form.set("occupiedCombs", entry.occupiedCombs);
  form.set("queenCells", entry.queenCells);
  form.set("varroaMites", entry.varroaMites === "" ? "" : entry.varroaMites === "ja" ? "true" : "false");
  for (const photo of entry.photos) {
    form.append("photos", new File([photo.blob], photo.name, { type: photo.type }));
  }
  return form;
}

// Versucht alle wartenden Einträge hochzuladen. Bricht beim ersten Fehler ab
// (z.B. immer noch offline) und versucht die restlichen später erneut.
export async function syncPendingEntries(): Promise<{ synced: number; remaining: number }> {
  const pending = await getPendingEntries();
  pending.sort((a, b) => a.createdAt - b.createdAt);
  let synced = 0;

  for (const entry of pending) {
    try {
      const res = await fetch("/api/entries", { method: "POST", body: buildFormData(entry) });
      if (!res.ok) {
        // vom Server abgelehnt (z.B. ungültige Daten) - aus der Warteschlange entfernen,
        // damit sie nicht endlos hängen bleibt
        await deletePendingEntry(entry.localId!);
        continue;
      }
      await deletePendingEntry(entry.localId!);
      synced++;
    } catch {
      break; // vermutlich immer noch offline
    }
  }

  const remaining = (await getPendingEntries()).length;
  return { synced, remaining };
}

// Wandelt einen wartenden Eintrag in dieselbe Form wie einen Server-Eintrag um,
// damit er in der Liste angezeigt werden kann.
export function pendingToDisplayEntry(entry: PendingEntry) {
  return {
    id: -(entry.localId || 0),
    hive: entry.hive,
    entry_date: entry.entryDate,
    notes: entry.notes,
    queen_color: entry.queenColor,
    queen_year: entry.queenYear,
    colony_strength: entry.colonyStrength,
    varroa: entry.varroa,
    feeding: entry.feeding,
    honey_harvest_kg: null,
    weight_kg: entry.weightKg || null,
    sighting_queen: entry.sightingQueen,
    sighting_larvae: entry.sightingLarvae,
    sighting_eggs: entry.sightingEggs,
    sighting_brood: entry.sightingBrood,
    occupied_combs: entry.occupiedCombs ? Number(entry.occupiedCombs) : null,
    queen_cells: entry.queenCells ? Number(entry.queenCells) : null,
    varroa_mites: entry.varroaMites === "" ? null : entry.varroaMites === "ja",
    photo_keys: [] as string[],
    created_at: new Date(entry.createdAt).toISOString(),
    pending: true as const,
    localPhotoUrls: entry.photos.map((p) => URL.createObjectURL(p.blob)),
  };
}

// Kleiner Cache für zuletzt geladene Daten, damit die App auch offline etwas anzeigen kann.
export function cacheSet(key: string, value: unknown) {
  try {
    localStorage.setItem(`cache:${key}`, JSON.stringify(value));
  } catch {
    // Speicher voll o.ä. - einfach ignorieren
  }
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
