import { useCallback, useEffect, useState, FormEvent } from "react";
import { apiUrl } from "./apiBase";
import { useT } from "./i18n";

interface HarvestEntry {
  year: number;
  kg: number | string | null;
}

interface Props {
  userId: number;
}

function currentYear() {
  return new Date().getFullYear();
}

// Hinweis: diese Komponente wird aktuell von nirgendwo importiert (durch HarvestPanel/
// HarvestSummary abgelöst) - bleibt trotzdem vollständig übersetzt, falls sie wieder
// gebraucht wird.
export default function YearlyHarvest({ userId }: Props) {
  const t = useT();
  const [entries, setEntries] = useState<HarvestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(currentYear());
  const [kg, setKg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/harvest?userId=${userId}`));
      const data: HarvestEntry[] = await res.json();
      setEntries([...data].sort((a, b) => b.year - a.year));
    } catch {
      setError(t.yearlyHarvest.loadError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(entry: HarvestEntry) {
    setYear(entry.year);
    setKg(entry.kg != null ? String(entry.kg) : "");
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/harvest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, year, kg: kg ? Number(kg) : null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setKg("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.genericSaveError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(y: number) {
    if (!confirm(t.yearlyHarvest.confirmDelete(y))) return;
    await fetch(apiUrl(`/api/harvest?userId=${userId}&year=${y}`), { method: "DELETE" });
    load();
  }

  return (
    <div className="harvest-view">
      <h2 className="harvest-heading">{t.yearlyHarvest.heading}</h2>
      <p className="muted">{t.yearlyHarvest.intro}</p>

      <form className="harvest-form" onSubmit={handleSubmit}>
        <label>
          {t.yearlyHarvest.yearLabel}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2000}
            max={2100}
          />
        </label>
        <label>
          {t.yearlyHarvest.totalLabel}
          <input
            type="number"
            step="0.1"
            min="0"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder={t.yearlyHarvest.totalPlaceholder}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? t.common.saving : t.common.save}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted">{t.harvestSummary.loading}</p>
      ) : entries.length === 0 ? (
        <p className="muted">{t.yearlyHarvest.empty}</p>
      ) : (
        <div className="harvest-list">
          {entries.map((entry) => (
            <div className="harvest-row" key={entry.year}>
              <span className="harvest-year">{entry.year}</span>
              <span className="harvest-kg">{entry.kg != null ? `${entry.kg} kg` : t.common.none}</span>
              <button type="button" className="link-btn" onClick={() => startEdit(entry)}>
                {t.common.edit}
              </button>
              <button type="button" className="delete-btn" onClick={() => handleDelete(entry.year)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
