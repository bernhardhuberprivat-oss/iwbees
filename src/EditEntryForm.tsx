import { useState, FormEvent } from "react";
import DatePicker from "./DatePicker";
import QueenColorField from "./QueenColorField";
import { updatePendingEntryFields } from "./offline";
import { Entry, getQueenColorForYear } from "./types";

interface Props {
  entry: Entry;
  userId: number;
  onSaved: () => void;
  onCancel: () => void;
}

function formatDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function EditEntryForm({ entry, userId, onSaved, onCancel }: Props) {
  const isPending = !!entry.pending;

  const [entryDate, setEntryDate] = useState(entry.entry_date.slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState(entry.notes || "");
  const [queenYear, setQueenYear] = useState<number | null>(entry.queen_year ?? null);
  const [colonyStrength, setColonyStrength] = useState(entry.colony_strength || "");
  const [varroa, setVarroa] = useState(entry.varroa || "");
  const [feeding, setFeeding] = useState(entry.feeding || "");
  const [weightKg, setWeightKg] = useState(entry.weight_kg ? String(entry.weight_kg) : "");
  const [newPhotos, setNewPhotos] = useState<FileList | null>(null);
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);
  const [removedIndices, setRemovedIndices] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const queenColor = getQueenColorForYear(queenYear)?.hex || null;

    try {
      if (isPending) {
        const localId = -entry.id;
        const total = entry.localPhotoUrls?.length || 0;
        const keepIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !removedIndices.includes(i));
        const newFiles = newPhotos
          ? Array.from(newPhotos).map((f) => ({ name: f.name, type: f.type, blob: f }))
          : [];
        await updatePendingEntryFields(
          localId,
          { entryDate, notes, queenColor, queenYear, colonyStrength, varroa, feeding, weightKg },
          keepIndices,
          newFiles
        );
      } else {
        const form = new FormData();
        form.set("id", String(entry.id));
        form.set("userId", String(userId));
        form.set("entryDate", entryDate);
        form.set("notes", notes);
        form.set("queenColor", queenColor || "");
        form.set("queenYear", queenYear ? String(queenYear) : "");
        form.set("colonyStrength", colonyStrength);
        form.set("varroa", varroa);
        form.set("feeding", feeding);
        if (weightKg) form.set("weightKg", weightKg);
        const keepKeys = (entry.photo_keys || []).filter((k) => !removedKeys.includes(k));
        form.set("keepPhotoKeys", JSON.stringify(keepKeys));
        if (newPhotos) Array.from(newPhotos).forEach((f) => form.append("photos", f));

        const res = await fetch("/api/entries", { method: "PUT", body: form });
        if (!res.ok) throw new Error(await res.text());
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="entry-form edit-entry-form" onSubmit={handleSubmit}>
      <h2 className="entry-form-heading">Eintrag bearbeiten</h2>

      <div className="full-width">
        <span className="field-label">Datum</span>
        <div className="date-toggle">
          <button type="button" className="active" onClick={() => setShowDatePicker((v) => !v)}>
            📅 {formatDisplay(entryDate)}
          </button>
        </div>
        {showDatePicker && (
          <DatePicker
            value={entryDate}
            onChange={(d) => {
              setEntryDate(d);
              setShowDatePicker(false);
            }}
          />
        )}
      </div>

      <div className="form-row">
        <label>
          Königin – Zuchtjahr
          <QueenColorField value={queenYear} onChange={setQueenYear} />
        </label>

        <label>
          Volksstärke
          <select value={colonyStrength} onChange={(e) => setColonyStrength(e.target.value)}>
            <option value="">–</option>
            <option value="schwach">schwach</option>
            <option value="mittel">mittel</option>
            <option value="stark">stark</option>
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Varroabefall
          <input type="text" value={varroa} onChange={(e) => setVarroa(e.target.value)} />
        </label>

        <label>
          Fütterung
          <input type="text" value={feeding} onChange={(e) => setFeeding(e.target.value)} />
        </label>

        <label>
          Stockgewicht (kg)
          <input
            type="number"
            step="0.1"
            min="0"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </label>
      </div>

      <label className="full-width">
        Notizen
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {!isPending && entry.photo_keys && entry.photo_keys.length > 0 && (
        <div className="full-width">
          <span className="field-label">Vorhandene Fotos</span>
          <div className="entry-photos edit-photos">
            {entry.photo_keys.map((key) => {
              const removed = removedKeys.includes(key);
              return (
                <div key={key} className={`edit-photo-thumb ${removed ? "removed" : ""}`}>
                  <img src={`/api/photo?key=${key}`} alt="Stockkontrolle" />
                  <button
                    type="button"
                    className="remove-photo-btn"
                    onClick={() =>
                      setRemovedKeys((prev) => (removed ? prev.filter((k) => k !== key) : [...prev, key]))
                    }
                  >
                    {removed ? "Zurückholen" : "Entfernen"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isPending && entry.localPhotoUrls && entry.localPhotoUrls.length > 0 && (
        <div className="full-width">
          <span className="field-label">Vorhandene Fotos</span>
          <div className="entry-photos edit-photos">
            {entry.localPhotoUrls.map((url, i) => {
              const removed = removedIndices.includes(i);
              return (
                <div key={url} className={`edit-photo-thumb ${removed ? "removed" : ""}`}>
                  <img src={url} alt="Stockkontrolle" />
                  <button
                    type="button"
                    className="remove-photo-btn"
                    onClick={() =>
                      setRemovedIndices((prev) => (removed ? prev.filter((idx) => idx !== i) : [...prev, i]))
                    }
                  >
                    {removed ? "Zurückholen" : "Entfernen"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <label className="full-width">
        Weitere Fotos hinzufügen
        <input type="file" accept="image/*" multiple onChange={(e) => setNewPhotos(e.target.files)} />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="edit-form-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? "Speichere…" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
