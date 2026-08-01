import { useCallback, useEffect, useState } from "react";
import { Entry, HiveInfo, HIVES, getQueenColorForYear } from "./types";
import NewEntryForm from "./NewEntryForm";
import EntryList from "./EntryList";
import ColorPicker from "./ColorPicker";
import StockChangeList from "./StockChangeList";
import YearlyHarvest from "./YearlyHarvest";
import UserPicker from "./UserPicker";
import { CurrentUser, getStoredUser, clearStoredUser } from "./userSession";
import { cacheGet, cacheSet, getPendingEntries, deletePendingEntry, pendingToDisplayEntry, syncPendingEntries } from "./offline";
import { readableTextColor } from "./colorUtils";

function formatDateDE(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

// Präfix, an dem automatisch erzeugte Stammdaten-Änderungsprotokolle erkannt werden,
// damit sie in einem eigenen Reiter statt bei den normalen Tageseinträgen erscheinen.
const STOCK_CHANGE_PREFIX = "Änderung an allgemeinen Daten vom Stock am";

// Übersetzt eine Änderung an den Stock-Stammdaten in lesbare Zeilen für den Tagebucheintrag.
function describeStockPatch(patch: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if ("name" in patch) lines.push(`Name: ${patch.name || "–"}`);
  if ("color" in patch) lines.push("Markierungsfarbe geändert");
  if ("category" in patch) lines.push(`Kategorie: ${patch.category || "–"}`);
  if ("queenYear" in patch) {
    const year = patch.queenYear as number | null;
    const color = year ? getQueenColorForYear(year) : null;
    lines.push(`Königin-Zuchtjahr: ${year ? `${year}${color ? ` (${color.name})` : ""}` : "–"}`);
  }
  if ("colonyStrength" in patch) lines.push(`Volksstärke: ${patch.colonyStrength || "–"}`);
  if ("weightKg" in patch) {
    const v = patch.weightKg as number | null;
    lines.push(`Stockgewicht: ${v != null ? `${v} kg` : "–"}`);
  }
  if ("sightingQueen" in patch) lines.push(`Sichtung Königin: ${patch.sightingQueen ? "ja" : "nein"}`);
  if ("sightingLarvae" in patch) lines.push(`Sichtung Larven: ${patch.sightingLarvae ? "ja" : "nein"}`);
  if ("sightingEggs" in patch) lines.push(`Sichtung Stifte: ${patch.sightingEggs ? "ja" : "nein"}`);
  if ("sightingBrood" in patch) lines.push(`Sichtung Brut: ${patch.sightingBrood ? "ja" : "nein"}`);
  if ("occupiedCombs" in patch) {
    const v = patch.occupiedCombs as number | null;
    lines.push(`Besetzte Waben: ${v ?? "–"}`);
  }
  if ("queenCells" in patch) {
    const v = patch.queenCells as number | null;
    lines.push(`Weiselzellen: ${v ?? "–"}`);
  }
  if ("varroaMites" in patch) {
    const v = patch.varroaMites as boolean | null;
    lines.push(`Varroamilben: ${v === null || v === undefined ? "–" : v ? "Ja" : "Nein"}`);
  }
  return lines;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => getStoredUser());

  if (!currentUser) {
    return (
      <div className="app">
        <header>
          <h1>🐝 Bienentagebuch</h1>
          <p className="subtitle">Kontrollen für deine 10 Bienenstöcke</p>
        </header>
        <UserPicker onLogin={setCurrentUser} />
      </div>
    );
  }

  return (
    <Diary
      user={currentUser}
      onSwitchUser={() => {
        clearStoredUser();
        setCurrentUser(null);
      }}
    />
  );
}

interface DiaryProps {
  user: CurrentUser;
  onSwitchUser: () => void;
}

function Diary({ user, onSwitchUser }: DiaryProps) {
  const [selectedHive, setSelectedHive] = useState<number | "all" | "harvest">("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiveInfo, setHiveInfo] = useState<Record<number, HiveInfo>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [entryTab, setEntryTab] = useState<"diary" | "changes">("diary");

  const loadEntries = useCallback(async () => {
    if (selectedHive === "harvest") {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const cacheKey = `entries:${user.id}:${selectedHive}`;
    try {
      const query = selectedHive === "all" ? "" : `&hive=${selectedHive}`;
      const res = await fetch(`/api/entries?userId=${user.id}${query}`);
      const data: Entry[] = await res.json();
      cacheSet(cacheKey, data);
      await mergeWithPending(data);
    } catch {
      // offline - letzten bekannten Stand aus dem Cache nehmen
      const cached = cacheGet<Entry[]>(cacheKey) || [];
      await mergeWithPending(cached);
    } finally {
      setLoading(false);
    }
  }, [selectedHive, user.id]);

  async function mergeWithPending(baseEntries: Entry[]) {
    const pending = await getPendingEntries(user.id);
    const relevant = pending.filter((p) => selectedHive === "all" || p.hive === selectedHive);
    const pendingDisplay = relevant.map(pendingToDisplayEntry);
    const combined = [...pendingDisplay, ...baseEntries].sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0
    );
    setEntries(combined);
    setPendingCount(pending.length);
  }

  const loadHiveInfo = useCallback(async () => {
    const cacheKey = `hiveInfo:${user.id}`;
    try {
      const res = await fetch(`/api/hive-colors?userId=${user.id}`);
      const data = await res.json();
      cacheSet(cacheKey, data);
      setHiveInfo(data);
    } catch {
      setHiveInfo(cacheGet<Record<number, HiveInfo>>(cacheKey) || {});
    }
  }, [user.id]);

  const trySync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncPendingEntries();
    } finally {
      setSyncing(false);
      loadEntries();
    }
  }, [loadEntries]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    loadHiveInfo();
  }, [loadHiveInfo]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      trySync();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (navigator.onLine) trySync();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    if (id < 0) {
      await deletePendingEntry(-id);
      loadEntries();
      return;
    }
    await fetch(`/api/entries?id=${id}&userId=${user.id}`, { method: "DELETE" });
    loadEntries();
  }

  async function handleUpdateHive(
    hive: number,
    patch: {
      color?: string | null;
      name?: string | null;
      category?: string | null;
      queenYear?: number | null;
      colonyStrength?: string | null;
      weightKg?: number | null;
      sightingQueen?: boolean;
      sightingLarvae?: boolean;
      sightingEggs?: boolean;
      sightingBrood?: boolean;
      occupiedCombs?: number | null;
      queenCells?: number | null;
      varroaMites?: boolean | null;
    }
  ) {
    setHiveInfo((prev) => {
      const next = { ...prev, [hive]: { ...prev[hive], ...patch } };
      cacheSet(`hiveInfo:${user.id}`, next);
      return next;
    });
    try {
      await fetch("/api/hive-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, hive, ...patch }),
      });
    } catch {
      // offline - Änderung bleibt lokal, wird beim nächsten Online-Besuch erneut gesendet
    }

    await logStockChange(hive, patch, { ...hiveInfo[hive], ...patch });
  }

  // Trägt automatisch einen Tagebucheintrag ein, wenn sich etwas im permanenten
  // Stock-Stammdaten-Fenster ändert - höchstens einen pro Stock und Tag, damit die Liste
  // nicht mit vielen gleichlautenden Einträgen zuspammt. Änderungen am selben Tag werden
  // an den bereits bestehenden Log-Eintrag angehängt, damit man sieht, was sich geändert hat.
  async function logStockChange(hive: number, patch: Record<string, unknown>, info: HiveInfo) {
    const changeLines = describeStockPatch(patch);
    if (changeLines.length === 0) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const titleLine = `${STOCK_CHANGE_PREFIX} ${formatDateDE(todayStr)}`;
    const queenColor = info.queenYear ? getQueenColorForYear(info.queenYear)?.hex ?? null : null;

    const existing = entries.find(
      (e) => e.hive === hive && e.entry_date === todayStr && e.notes?.startsWith(titleLine) && e.id > 0
    );

    try {
      if (existing) {
        const updatedNotes = `${existing.notes}\n${changeLines.join("\n")}`;
        const form = new FormData();
        form.set("id", String(existing.id));
        form.set("userId", String(user.id));
        form.set("entryDate", todayStr);
        form.set("notes", updatedNotes);
        form.set("queenColor", queenColor || "");
        form.set("queenYear", info.queenYear ? String(info.queenYear) : "");
        form.set("colonyStrength", info.colonyStrength || "");
        form.set("varroa", existing.varroa || "");
        form.set("feeding", existing.feeding || "");
        form.set("weightKg", info.weightKg != null ? String(info.weightKg) : "");
        form.set("keepPhotoKeys", JSON.stringify(existing.photo_keys || []));
        await fetch("/api/entries", { method: "PUT", body: form });
      } else {
        const notes = `${titleLine}\n${changeLines.join("\n")}`;
        const form = new FormData();
        form.set("userId", String(user.id));
        form.set("hive", String(hive));
        form.set("entryDate", todayStr);
        form.set("notes", notes);
        form.set("queenColor", queenColor || "");
        form.set("queenYear", info.queenYear ? String(info.queenYear) : "");
        form.set("colonyStrength", info.colonyStrength || "");
        form.set("weightKg", info.weightKg != null ? String(info.weightKg) : "");
        form.set("varroa", "");
        form.set("feeding", "");
        await fetch("/api/entries", { method: "POST", body: form });
      }
      if (selectedHive === hive) {
        loadEntries();
      }
    } catch {
      // offline - Log-Eintrag wird nicht nachgeholt, die eigentliche Änderung bleibt aber erhalten
    }
  }

  const selectedInfo = typeof selectedHive === "number" ? hiveInfo[selectedHive] : undefined;

  return (
    <div className="app">
      <header>
        <h1>🐝 Bienentagebuch</h1>
        <p className="subtitle">Kontrollen für deine 10 Bienenstöcke</p>
      </header>

      <div className="user-bar">
        <span>👤 {user.name}</span>
        <button className="link-btn" onClick={onSwitchUser}>
          Nutzer wechseln
        </button>
      </div>

      <div className={`status-bar ${isOnline ? "online" : "offline"}`}>
        <span>{isOnline ? "🟢 Online" : "🔴 Kein Internet"}</span>
        {pendingCount > 0 && (
          <span className="pending-info">
            {pendingCount} {pendingCount === 1 ? "Eintrag wartet" : "Einträge warten"} auf Upload
            {isOnline && (
              <button className="sync-btn" onClick={trySync} disabled={syncing}>
                {syncing ? "Synchronisiere…" : "Jetzt synchronisieren"}
              </button>
            )}
          </span>
        )}
      </div>

      <nav className="hive-tabs">
        <button
          className={selectedHive === "all" ? "active" : ""}
          onClick={() => setSelectedHive("all")}
        >
          Alle
        </button>
        {HIVES.map((h) => {
          const info = hiveInfo[h];
          const color = info?.color;
          const label = info?.name?.trim() || `Stock ${h}`;
          const isActive = selectedHive === h;
          const style = color
            ? isActive
              ? { boxShadow: `0 0 0 3px ${color}` }
              : { background: color, borderColor: color, color: readableTextColor(color) }
            : undefined;
          return (
            <button
              key={h}
              className={isActive ? "active" : ""}
              style={style}
              onClick={() => setSelectedHive(h)}
            >
              {label}
            </button>
          );
        })}
        <button
          className={`harvest-tab ${selectedHive === "harvest" ? "active" : ""}`}
          onClick={() => setSelectedHive("harvest")}
        >
          🍯 Ertrag
        </button>
      </nav>

      {typeof selectedHive === "number" && (
        <ColorPicker
          hive={selectedHive}
          currentColor={selectedInfo?.color}
          currentName={selectedInfo?.name}
          currentCategory={selectedInfo?.category}
          currentQueenYear={selectedInfo?.queenYear}
          currentColonyStrength={selectedInfo?.colonyStrength}
          currentWeightKg={selectedInfo?.weightKg}
          sightingQueen={selectedInfo?.sightingQueen}
          sightingLarvae={selectedInfo?.sightingLarvae}
          sightingEggs={selectedInfo?.sightingEggs}
          sightingBrood={selectedInfo?.sightingBrood}
          occupiedCombs={selectedInfo?.occupiedCombs}
          queenCells={selectedInfo?.queenCells}
          varroaMites={selectedInfo?.varroaMites}
          onPickColor={(color) => handleUpdateHive(selectedHive, { color })}
          onRename={(name) => handleUpdateHive(selectedHive, { name })}
          onCategoryChange={(category) => handleUpdateHive(selectedHive, { category })}
          onQueenYearChange={(queenYear) => handleUpdateHive(selectedHive, { queenYear })}
          onColonyStrengthChange={(colonyStrength) => handleUpdateHive(selectedHive, { colonyStrength })}
          onWeightChange={(weightKg) => handleUpdateHive(selectedHive, { weightKg })}
          onSightingsChange={(patch) => handleUpdateHive(selectedHive, patch)}
        />
      )}

      <main>
        {selectedHive === "harvest" ? (
          <YearlyHarvest userId={user.id} />
        ) : (
          <>
            {selectedHive === "all" ? (
              <p className="muted hint">Wähle oben einen Stock aus, um einen neuen Eintrag anzulegen.</p>
            ) : (
              <NewEntryForm
                key={selectedHive}
                userId={user.id}
                hive={selectedHive}
                hiveColor={selectedInfo?.color ?? undefined}
                hiveName={selectedInfo?.name ?? undefined}
                queenYear={selectedInfo?.queenYear ?? null}
                colonyStrength={selectedInfo?.colonyStrength ?? null}
                weightKg={selectedInfo?.weightKg ?? null}
                varroaMites={selectedInfo?.varroaMites ?? null}
                onCreated={loadEntries}
              />
            )}
            <section>
              <div className="entry-tabs">
                <button
                  type="button"
                  className={entryTab === "diary" ? "active" : ""}
                  onClick={() => setEntryTab("diary")}
                >
                  Tageseinträge
                </button>
                <button
                  type="button"
                  className={entryTab === "changes" ? "active" : ""}
                  onClick={() => setEntryTab("changes")}
                >
                  Änderungen in den Stammdaten
                </button>
              </div>
              {entryTab === "changes" ? (
                <StockChangeList
                  entries={entries.filter((e) => e.notes?.startsWith(STOCK_CHANGE_PREFIX))}
                  loading={loading}
                  onDelete={handleDelete}
                  hiveInfo={hiveInfo}
                />
              ) : (
                <EntryList
                  entries={entries.filter((e) => !e.notes?.startsWith(STOCK_CHANGE_PREFIX))}
                  loading={loading}
                  userId={user.id}
                  onDelete={handleDelete}
                  onUpdated={loadEntries}
                  hiveInfo={hiveInfo}
                />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
