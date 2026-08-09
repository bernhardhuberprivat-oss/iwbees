import { useState, FormEvent } from "react";
import { apiUrl } from "./apiBase";
import { readableTextColor, hiveRingColor } from "./colorUtils";
import { buildHiveRange, HiveInfo } from "./types";

export interface HarvestEntry {
  id: number;
  entry_date: string;
  kg: number | string;
  // null/undefined = Gesamtertrag über alle Stöcke, sonst Ertrag für genau diesen Stock.
  hive?: number | null;
}

interface Props {
  userId: number;
  entries: HarvestEntry[];
  hiveCount: number;
  hiveInfo: Record<number, HiveInfo>;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

type Mode = "gesamt" | "stock";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateDE(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE");
}

function hiveBadgeStyle(color?: string | null) {
  if (!color) return undefined;
  return { background: color, borderColor: hiveRingColor(color), color: readableTextColor(color) };
}

interface DateGroup {
  date: string;
  gesamt: HarvestEntry[];
  perStock: HarvestEntry[];
}

// Fasst die (nach Datum absteigend sortierten) Einträge pro Tag zusammen, damit man bei
// einer Pro-Stock-Erfassung nicht 10 einzelne, unbeschriftete Zeilen sieht, sondern einen
// Tagesblock mit allen Stöcken und einer Summe.
function groupByDate(entries: HarvestEntry[]): DateGroup[] {
  const groups: DateGroup[] = [];
  const byDate = new Map<string, DateGroup>();
  for (const entry of entries) {
    let group = byDate.get(entry.entry_date);
    if (!group) {
      group = { date: entry.entry_date, gesamt: [], perStock: [] };
      byDate.set(entry.entry_date, group);
      groups.push(group);
    }
    if (entry.hive == null) {
      group.gesamt.push(entry);
    } else {
      group.perStock.push(entry);
    }
  }
  return groups;
}

// Popup zum Erfassen eines Honigertrags. Entweder als Gesamtmenge (wie bisher, ein Feld)
// oder pro Stock (ein Feld je Stock, passend zur eingestellten Stockanzahl) - Datum ist
// immer das heutige. Darunter die Historie, nach Tag gruppiert und mit Gesamt- bzw.
// Stock-Beschriftung, damit klar bleibt, was wie erfasst wurde.
export default function HarvestPanel({
  userId,
  entries,
  hiveCount,
  hiveInfo,
  onSaved,
  onDeleted,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("gesamt");
  const [kg, setKg] = useState("");
  const [perStockKg, setPerStockKg] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function postEntry(hive: number | null, value: number) {
    const res = await fetch(apiUrl("/api/harvest-entries"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, entryDate: today(), kg: value, hive }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "gesamt") {
      const value = Number(kg);
      if (!value || value <= 0) {
        setError("Bitte eine Menge größer 0 eingeben.");
        return;
      }
      setSubmitting(true);
      try {
        await postEntry(null, value);
        setKg("");
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Speichern");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const toSave = Object.entries(perStockKg)
      .map(([hive, val]) => ({ hive: Number(hive), kg: Number(val) }))
      .filter((e) => e.kg > 0);

    if (toSave.length === 0) {
      setError("Bitte für mindestens einen Stock eine Menge größer 0 eingeben.");
      return;
    }

    setSubmitting(true);
    try {
      for (const { hive, kg: value } of toSave) {
        await postEntry(hive, value);
      }
      setPerStockKg({});
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Diesen Ertragseintrag wirklich löschen?")) return;
    await fetch(apiUrl(`/api/harvest-entries?id=${id}&userId=${userId}`), { method: "DELETE" });
    onDeleted();
  }

  const groups = groupByDate(entries);

  return (
    <div className="harvest-overlay" onClick={onClose}>
      <div className="harvest-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label="Schließen">
          ✕
        </button>

        <h2 className="harvest-panel-heading">🍯 Ertrag eingeben</h2>

        <div className="date-toggle harvest-mode-toggle">
          <button type="button" className={mode === "gesamt" ? "active" : ""} onClick={() => setMode("gesamt")}>
            Ertrag gesamt
          </button>
          <button type="button" className={mode === "stock" ? "active" : ""} onClick={() => setMode("stock")}>
            Ertrag pro Stock
          </button>
        </div>

        <form className="harvest-panel-form" onSubmit={handleSubmit}>
          <div className="harvest-panel-date">Datum: {formatDateDE(today())}</div>

          {mode === "gesamt" ? (
            <label>
              Menge gesamt (kg)
              <input
                type="number"
                step="0.1"
                min="0"
                autoFocus
                placeholder="z.B. 12.5"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </label>
          ) : (
            <>
              <p className="muted harvest-stock-hint">
                Menge je Stock eintragen – leere Felder werden nicht gespeichert.
              </p>
              <div className="harvest-stock-grid">
                {buildHiveRange(hiveCount).map((h) => {
                  const info = hiveInfo[h];
                  const label = info?.name?.trim() || `Stock ${h}`;
                  return (
                    <div className="harvest-stock-row" key={h}>
                      <span className="hive-badge" style={hiveBadgeStyle(info?.color)}>
                        {label}
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0"
                        aria-label={`Ertrag für ${label} (kg)`}
                        value={perStockKg[h] ?? ""}
                        onChange={(e) =>
                          setPerStockKg((prev) => ({ ...prev, [h]: e.target.value }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Speichere…" : "Speichern"}
          </button>
        </form>

        <div className="harvest-history">
          <h3 className="harvest-history-heading">Historie</h3>
          {groups.length === 0 ? (
            <p className="muted">Noch keine Erträge erfasst.</p>
          ) : (
            <div className="harvest-history-list">
              {groups.map((group) => {
                const stockTotal = group.perStock.reduce((sum, e) => sum + Number(e.kg), 0);
                return (
                  <div className="harvest-history-day" key={group.date}>
                    <div className="harvest-history-day-date">{formatDateDE(group.date)}</div>

                    {group.gesamt.map((entry) => (
                      <div className="harvest-history-row" key={entry.id}>
                        <span className="harvest-history-label hive-badge">Gesamt</span>
                        <span className="harvest-history-kg">{entry.kg} kg</span>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => handleDelete(entry.id)}
                          title="Löschen"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {group.perStock.map((entry) => {
                      const info = hiveInfo[entry.hive as number];
                      const label = info?.name?.trim() || `Stock ${entry.hive}`;
                      return (
                        <div className="harvest-history-row" key={entry.id}>
                          <span className="harvest-history-label hive-badge" style={hiveBadgeStyle(info?.color)}>
                            {label}
                          </span>
                          <span className="harvest-history-kg">{entry.kg} kg</span>
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => handleDelete(entry.id)}
                            title="Löschen"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}

                    {group.perStock.length > 1 && (
                      <div className="harvest-history-day-total">
                        Summe Stöcke: {stockTotal.toFixed(1)} kg
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
