import { useEffect, useState, FormEvent } from "react";
import { apiUrl } from "./apiBase";

export interface HarvestEntry {
  id: number;
  entry_date: string;
  kg: number | string;
}

interface Props {
  userId: number;
  entries: HarvestEntry[];
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateDE(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE");
}

// Popup zum Erfassen eines Honigertrags - Datum ist immer das heutige, darunter die
// Historie der letzten 20 Einträge. Enter speichert und schließt das Fenster gleich wieder,
// alternativ schließt das X oben rechts ohne zu speichern.
export default function HarvestPanel({ userId, entries, onSaved, onDeleted, onClose }: Props) {
  const [kg, setKg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(kg);
    if (!value || value <= 0) {
      setError("Bitte eine Menge größer 0 eingeben.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/harvest-entries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, entryDate: today(), kg: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      setKg("");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Diesen Ertragseintrag wirklich löschen?")) return;
    await fetch(apiUrl(`/api/harvest-entries?id=${id}&userId=${userId}`), { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="harvest-overlay" onClick={onClose}>
      <div className="harvest-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label="Schließen">
          ✕
        </button>

        <h2 className="harvest-panel-heading">🍯 Ertrag eingeben</h2>

        <form className="harvest-panel-form" onSubmit={handleSubmit}>
          <div className="harvest-panel-date">Datum: {formatDateDE(today())}</div>
          <label>
            Menge (kg)
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
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Speichere…" : "Speichern"}
          </button>
        </form>

        <div className="harvest-history">
          <h3 className="harvest-history-heading">Historie (letzte 20 Einträge)</h3>
          {entries.length === 0 ? (
            <p className="muted">Noch keine Erträge erfasst.</p>
          ) : (
            <div className="harvest-history-list">
              {entries.map((entry) => (
                <div className="harvest-history-row" key={entry.id}>
                  <span className="harvest-history-date">{formatDateDE(entry.entry_date)}</span>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
