import { useState, FormEvent } from "react";
import { apiUrl } from "./apiBase";
import { readableTextColor, hiveRingColor } from "./colorUtils";
import { buildHiveRange, HiveInfo } from "./types";
import { useT, useLang, dateLocale } from "./i18n";

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
  const t = useT();
  const { lang } = useLang();
  const [mode, setMode] = useState<Mode>("gesamt");
  const [kg, setKg] = useState("");
  const [perStockKg, setPerStockKg] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function formatDateDE(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(dateLocale(lang));
  }

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
        setError(t.harvestPanel.errTotalPositive);
        return;
      }
      setSubmitting(true);
      try {
        await postEntry(null, value);
        setKg("");
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : t.common.genericSaveError);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const toSave = Object.entries(perStockKg)
      .map(([hive, val]) => ({ hive: Number(hive), kg: Number(val) }))
      .filter((e) => e.kg > 0);

    if (toSave.length === 0) {
      setError(t.harvestPanel.errAnyPositive);
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
      setError(err instanceof Error ? err.message : t.common.genericSaveError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.harvestPanel.confirmDelete)) return;
    await fetch(apiUrl(`/api/harvest-entries?id=${id}&userId=${userId}`), { method: "DELETE" });
    onDeleted();
  }

  const groups = groupByDate(entries);

  return (
    <div className="harvest-overlay" onClick={onClose}>
      <div className="harvest-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>

        <h2 className="harvest-panel-heading">{t.harvestPanel.heading}</h2>

        <div className="date-toggle harvest-mode-toggle">
          <button type="button" className={mode === "gesamt" ? "active" : ""} onClick={() => setMode("gesamt")}>
            {t.harvestPanel.modeTotal}
          </button>
          <button type="button" className={mode === "stock" ? "active" : ""} onClick={() => setMode("stock")}>
            {t.harvestPanel.modePerHive}
          </button>
        </div>

        <form className="harvest-panel-form" onSubmit={handleSubmit}>
          <div className="harvest-panel-date">{t.harvestPanel.dateLabel(formatDateDE(today()))}</div>

          {mode === "gesamt" ? (
            <label>
              {t.harvestPanel.totalAmount}
              <input
                type="number"
                step="0.1"
                min="0"
                autoFocus
                placeholder={t.harvestPanel.totalPlaceholder}
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </label>
          ) : (
            <>
              <p className="muted harvest-stock-hint">{t.harvestPanel.perHiveHint}</p>
              <div className="harvest-stock-grid">
                {buildHiveRange(hiveCount).map((h) => {
                  const info = hiveInfo[h];
                  const label = info?.name?.trim() || t.common.hiveFallback(h);
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
                        aria-label={t.harvestPanel.hiveYieldLabel(label)}
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
            {submitting ? t.common.saving : t.common.save}
          </button>
        </form>

        <div className="harvest-history">
          <h3 className="harvest-history-heading">{t.harvestPanel.history}</h3>
          {groups.length === 0 ? (
            <p className="muted">{t.harvestPanel.noHistory}</p>
          ) : (
            <div className="harvest-history-list">
              {groups.map((group) => {
                const stockTotal = group.perStock.reduce((sum, e) => sum + Number(e.kg), 0);
                return (
                  <div className="harvest-history-day" key={group.date}>
                    <div className="harvest-history-day-date">{formatDateDE(group.date)}</div>

                    {group.gesamt.map((entry) => (
                      <div className="harvest-history-row" key={entry.id}>
                        <span className="harvest-history-label hive-badge">{t.harvestPanel.total}</span>
                        <span className="harvest-history-kg">{entry.kg} kg</span>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => handleDelete(entry.id)}
                          title={t.common.delete}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {group.perStock.map((entry) => {
                      const info = hiveInfo[entry.hive as number];
                      const label = info?.name?.trim() || t.common.hiveFallback(entry.hive as number);
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
                            title={t.common.delete}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}

                    {group.perStock.length > 1 && (
                      <div className="harvest-history-day-total">{t.harvestPanel.stockSum(stockTotal.toFixed(1))}</div>
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
