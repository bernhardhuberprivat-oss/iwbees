import { useCallback, useEffect, useState, FormEvent } from "react";
import { Entry, HiveInfo, buildHiveRange, getQueenColorForYear } from "./types";
import NewEntryForm from "./NewEntryForm";
import EntryList from "./EntryList";
import ColorPicker from "./ColorPicker";
import HarvestPanel, { HarvestEntry } from "./HarvestPanel";
import UserPicker from "./UserPicker";
import { CurrentUser, getStoredUser, clearStoredUser, storeUser } from "./userSession";
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
  const [selectedHive, setSelectedHive] = useState<number | "all">("all");
  const [harvestEntries, setHarvestEntries] = useState<HarvestEntry[]>([]);
  const [harvestYearTotal, setHarvestYearTotal] = useState(0);
  const [showHarvestPanel, setShowHarvestPanel] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiveInfo, setHiveInfo] = useState<Record<number, HiveInfo>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [hiveCount, setHiveCount] = useState(user.hiveCount || 10);
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [showHiveCountEditor, setShowHiveCountEditor] = useState(false);
  const [hiveCountInput, setHiveCountInput] = useState(String(user.hiveCount || 10));
  const [hiveCountError, setHiveCountError] = useState("");
  const [savingHiveCount, setSavingHiveCount] = useState(false);

  async function handleSaveHiveCount(e: FormEvent) {
    e.preventDefault();
    const next = Number(hiveCountInput);
    if (!Number.isInteger(next) || next < 1 || next > 60) {
      setHiveCountError("Bitte eine Zahl zwischen 1 und 60 eingeben.");
      return;
    }
    setSavingHiveCount(true);
    setHiveCountError("");
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, hiveCount: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      setHiveCount(next);
      storeUser({ ...user, hiveCount: next });
      if (typeof selectedHive === "number" && selectedHive > next) {
        setSelectedHive("all");
      }
      setShowHiveCountEditor(false);
    } catch {
      setHiveCountError("Speichern fehlgeschlagen. Bitte Internetverbindung prüfen.");
    } finally {
      setSavingHiveCount(false);
    }
  }

  useEffect(() => {
    setShowNewEntryForm(false);
  }, [selectedHive]);

  const loadEntries = useCallback(async () => {
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

  const loadHarvest = useCallback(async () => {
    try {
      const res = await fetch(`/api/harvest-entries?userId=${user.id}&year=${new Date().getFullYear()}`);
      const data = await res.json();
      setHarvestEntries(data.entries || []);
      setHarvestYearTotal(Number(data.yearTotal) || 0);
    } catch {
      // offline - Badge zeigt einfach den zuletzt bekannten Stand
    }
  }, [user.id]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    loadHiveInfo();
  }, [loadHiveInfo]);

  useEffect(() => {
    loadHarvest();
  }, [loadHarvest]);

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
        form.set("weightKg", existing.weight_kg != null ? String(existing.weight_kg) : "");
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

  // Zeigt im Stammdaten-Fenster nur an, ob laut dem letzten Tageseintrag mit erfasster
  // Varroamilben-Angabe aktuell "Ja" gilt - verschwindet automatisch, sobald ein neuerer
  // Eintrag "Nein" erfasst. Rein abgeleitet, hier nicht editierbar (nur im Tageseintrag).
  const latestVarroaEntry =
    typeof selectedHive === "number"
      ? entries.find((e) => e.hive === selectedHive && e.varroa_mites !== null && e.varroa_mites !== undefined)
      : undefined;
  const varroaMitesActive = latestVarroaEntry ? !!latestVarroaEntry.varroa_mites : false;

  // Zeigt im Stammdaten-Fenster den zuletzt im Tageseintrag erfassten Stockgewicht-Wert an -
  // bleibt stehen, bis ein neuerer Eintrag einen neuen Wert setzt. Rein abgeleitet, hier
  // nicht editierbar (nur im Tageseintrag).
  const latestWeightEntry =
    typeof selectedHive === "number"
      ? entries.find((e) => e.hive === selectedHive && e.weight_kg !== null && e.weight_kg !== undefined)
      : undefined;
  const latestWeightKg = latestWeightEntry ? Number(latestWeightEntry.weight_kg) : null;

  return (
    <div className="app">
      <header>
        <h1>🐝 Bienentagebuch</h1>
        <p className="subtitle">Kontrollen für deine {hiveCount} Bienenstöcke</p>
        <button
          type="button"
          className="hive-count-toggle"
          onClick={() => {
            setHiveCountInput(String(hiveCount));
            setHiveCountError("");
            setShowHiveCountEditor((v) => !v);
          }}
        >
          Anzahl Bienenstöcke ändern
        </button>
        {showHiveCountEditor && (
          <form className="hive-count-editor" onSubmit={handleSaveHiveCount}>
            <label>
              Anzahl Bienenstöcke
              <input
                type="number"
                min={1}
                max={60}
                value={hiveCountInput}
                onChange={(e) => setHiveCountInput(e.target.value)}
                autoFocus
              />
            </label>
            {hiveCountError && <p className="error">{hiveCountError}</p>}
            <div className="hive-count-editor-actions">
              <button type="button" className="secondary" onClick={() => setShowHiveCountEditor(false)}>
                Abbrechen
              </button>
              <button type="submit" disabled={savingHiveCount}>
                {savingHiveCount ? "Speichere…" : "Speichern"}
              </button>
            </div>
          </form>
        )}
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
        {buildHiveRange(hiveCount).map((h) => {
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
      </nav>

      <div className="harvest-bar">
        <button type="button" className="harvest-open-btn" onClick={() => setShowHarvestPanel(true)}>
          🍯 Ertrag eingeben
        </button>
        <span className="harvest-year-badge">
          🍯 {harvestYearTotal} kg ({new Date().getFullYear()})
        </span>
      </div>

      {showHarvestPanel && (
        <HarvestPanel
          userId={user.id}
          entries={harvestEntries}
          onSaved={loadHarvest}
          onDeleted={loadHarvest}
          onClose={() => setShowHarvestPanel(false)}
        />
      )}

      {typeof selectedHive === "number" && (
        <ColorPicker
          hive={selectedHive}
          currentColor={selectedInfo?.color}
          currentName={selectedInfo?.name}
          currentCategory={selectedInfo?.category}
          currentQueenYear={selectedInfo?.queenYear}
          currentColonyStrength={selectedInfo?.colonyStrength}
          varroaMitesActive={varroaMitesActive}
          latestWeightKg={latestWeightKg}
          recentChanges={entries
            .filter((e) => e.hive === selectedHive && e.notes?.startsWith(STOCK_CHANGE_PREFIX))
            .slice(0, 5)}
          onDeleteChange={handleDelete}
          onPickColor={(color) => handleUpdateHive(selectedHive, { color })}
          onRename={(name) => handleUpdateHive(selectedHive, { name })}
          onCategoryChange={(category) => handleUpdateHive(selectedHive, { category })}
          onQueenYearChange={(queenYear) => handleUpdateHive(selectedHive, { queenYear })}
          onColonyStrengthChange={(colonyStrength) => handleUpdateHive(selectedHive, { colonyStrength })}
        />
      )}

      <main>
        {selectedHive === "all" && (
          <p className="muted hint">Wähle oben einen Stock aus, um einen neuen Eintrag anzulegen.</p>
        )}
        <section>
          <div className="section-heading-row">
            <h2>Tageseinträge</h2>
            {selectedHive !== "all" && (
              <button
                type="button"
                className={`new-entry-toggle ${showNewEntryForm ? "pulsing" : ""}`}
                style={
                  showNewEntryForm && selectedInfo?.color
                    ? ({ "--hive-pulse-color": selectedInfo.color } as any)
                    : undefined
                }
                onClick={() => setShowNewEntryForm((v) => !v)}
              >
                {showNewEntryForm ? "Neuer Tageseintrag ✕" : "+ Neuer Tageseintrag"}
              </button>
            )}
          </div>

          {selectedHive !== "all" && showNewEntryForm && (
            <NewEntryForm
              key={selectedHive}
              userId={user.id}
              hive={selectedHive}
              hiveColor={selectedInfo?.color ?? undefined}
              hiveName={selectedInfo?.name ?? undefined}
              queenYear={selectedInfo?.queenYear ?? null}
              colonyStrength={selectedInfo?.colonyStrength ?? null}
              onCreated={() => {
                loadEntries();
                // Fenster erst schließen, wenn die Biene fertig davongeflogen ist.
                setTimeout(() => setShowNewEntryForm(false), 1300);
              }}
              onClose={() => setShowNewEntryForm(false)}
            />
          )}

          <EntryList
            entries={entries.filter((e) => !e.notes?.startsWith(STOCK_CHANGE_PREFIX))}
            loading={loading}
            userId={user.id}
            onDelete={handleDelete}
            onUpdated={loadEntries}
            hiveInfo={hiveInfo}
          />
        </section>
      </main>
    </div>
  );
}
