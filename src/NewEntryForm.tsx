import { useState, FormEvent } from "react";
import DatePicker from "./DatePicker";
import { addPendingEntry } from "./offline";
import { readableTextColor } from "./colorUtils";
import { getQueenColorForYear } from "./types";

interface Props {
  userId: number;
  hive: number;
  hiveColor?: string;
  hiveName?: string;
  queenYear: number | null;
  colonyStrength: string | null;
  weightKg: number | null;
  varroaMites?: boolean | null;
  onCreated: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

function formatDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function NewEntryForm({
  userId,
  hive,
  hiveColor,
  hiveName,
  queenYear,
  colonyStrength,
  weightKg,
  varroaMites,
  onCreated,
}: Props) {
  const [entryDate, setEntryDate] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [varroa, setVarroa] = useState("");
  const [feeding, setFeeding] = useState("");
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const queenColorInfo = getQueenColorForYear(queenYear);

  function resetForm() {
    setEntryDate(today());
    setShowDatePicker(false);
    setNotes("");
    setVarroa("");
    setFeeding("");
    setPhotos(null);
    (document.getElementById("photo-input") as HTMLInputElement | null)?.value &&
      ((document.getElementById("photo-input") as HTMLInputElement).value = "");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setInfo("");
    const photoList = photos ? Array.from(photos) : [];
    const queenColor = queenColorInfo?.hex || null;

    try {
      const form = new FormData();
      form.set("userId", String(userId));
      form.set("hive", String(hive));
      form.set("entryDate", entryDate);
      form.set("notes", notes);
      form.set("queenColor", queenColor || "");
      form.set("queenYear", queenYear ? String(queenYear) : "");
      form.set("colonyStrength", colonyStrength || "");
      form.set("varroa", varroa);
      form.set("feeding", feeding);
      form.set("weightKg", weightKg != null ? String(weightKg) : "");
      photoList.forEach((file) => form.append("photos", file));

      const res = await fetch("/api/entries", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());

      resetForm();
      onCreated();
    } catch (err) {
      if (err instanceof TypeError) {
        // Kein Netzwerk erreichbar - Eintrag lokal speichern und später automatisch hochladen
        try {
          await addPendingEntry({
            userId,
            hive,
            entryDate,
            notes,
            queenColor,
            queenYear,
            colonyStrength: colonyStrength || "",
            varroa,
            feeding,
            weightKg: weightKg != null ? String(weightKg) : "",
            photos: photoList.map((f) => ({ name: f.name, type: f.type, blob: f })),
          });
          setInfo("Kein Internet – Eintrag wurde lokal gespeichert und wird automatisch hochgeladen, sobald du wieder online bist.");
          resetForm();
          onCreated();
        } catch {
          setError("Eintrag konnte weder gesendet noch lokal gespeichert werden.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Fehler beim Speichern");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <h2
        className="entry-form-heading"
        style={hiveColor ? { background: hiveColor, color: readableTextColor(hiveColor) } : undefined}
      >
        Neuer Tageseintrag – {hiveName || `Stock ${hive}`}
      </h2>

      <div className="full-width">
        <span className="field-label">Datum</span>
        <div className="date-toggle">
          <button
            type="button"
            className={entryDate === today() ? "active" : ""}
            onClick={() => {
              setEntryDate(today());
              setShowDatePicker(false);
            }}
          >
            Heute · {formatDisplay(today())}
          </button>
          <button
            type="button"
            className={entryDate !== today() ? "active" : ""}
            onClick={() => setShowDatePicker((v) => !v)}
          >
            📅 {entryDate !== today() ? formatDisplay(entryDate) : "Individuelles Datum"}
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
        {varroaMites && (
          <label>
            Varroabefallbehandlung
            <input
              type="text"
              placeholder="z.B. gering, behandelt"
              value={varroa}
              onChange={(e) => setVarroa(e.target.value)}
            />
          </label>
        )}

        <label>
          Fütterung
          <input
            type="text"
            placeholder="z.B. 2L Sirup"
            value={feeding}
            onChange={(e) => setFeeding(e.target.value)}
          />
        </label>

      </div>

      <label className="full-width">
        Notizen
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <label className="full-width">
        Fotos
        <input
          id="photo-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setPhotos(e.target.files)}
        />
      </label>

      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Speichere…" : "Eintrag speichern"}
      </button>
    </form>
  );
}
