import { useCallback, useEffect, useState, FormEvent } from "react";
import { apiUrl } from "./apiBase";

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

export default function YearlyHarvest({ userId }: Props) {
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
      setError("Erträge konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
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
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(y: number) {
    if (!confirm(`Ertrag für ${y} wirklich löschen?`)) return;
    await fetch(apiUrl(`/api/harvest?userId=${userId}&year=${y}`), { method: "DELETE" });
    load();
  }

  return (
    <div className="harvest-view">
      <h2 className="harvest-heading">🍯 Gesamtertrag pro Jahr</h2>
      <p className="muted">Trage hier die insgesamt geerntete Honigmenge für ein Jahr ein – über alle Bienenstöcke zusammen.</p>

      <form className="harvest-form" onSubmit={handleSubmit}>
        <label>
          Jahr
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2000}
            max={2100}
          />
        </label>
        <label>
          Ertrag gesamt (kg)
          <input
            type="number"
            step="0.1"
            min="0"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="z.B. 42.5"
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Speichere…" : "Speichern"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted">Lade…</p>
      ) : entries.length === 0 ? (
        <p className="muted">Noch keine Erträge erfasst.</p>
      ) : (
        <div className="harvest-list">
          {entries.map((entry) => (
            <div className="harvest-row" key={entry.year}>
              <span className="harvest-year">{entry.year}</span>
              <span className="harvest-kg">{entry.kg != null ? `${entry.kg} kg` : "–"}</span>
              <button type="button" className="link-btn" onClick={() => startEdit(entry)}>
                Bearbeiten
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
