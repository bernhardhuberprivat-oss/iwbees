import { useState, FormEvent } from "react";
import DatePicker from "./DatePicker";
import QueenColorField from "./QueenColorField";
import { updatePendingEntryFields } from "./offline";
import { compressImages } from "./imageCompression";
import { Entry, getQueenColorForYear } from "./types";
import { apiUrl } from "./apiBase";
import { useT, useLang, dateLocale } from "./i18n";

interface Props {
  entry: Entry;
  userId: number;
  onSaved: () => void;
  onCancel: () => void;
}

export default function EditEntryForm({ entry, userId, onSaved, onCancel }: Props) {
  const t = useT();
  const { lang } = useLang();
  const isPending = !!entry.pending;

  function formatDisplay(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(dateLocale(lang), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const [entryDate, setEntryDate] = useState(entry.entry_date.slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState(entry.notes || "");
  const [queenYear, setQueenYear] = useState<number | null>(entry.queen_year ?? null);
  const [colonyStrength, setColonyStrength] = useState(entry.colony_strength || "");
  const [varroa, setVarroa] = useState(entry.varroa || "");
  const [feeding, setFeeding] = useState(entry.feeding || "");
  const [weightKg, setWeightKg] = useState(entry.weight_kg ? String(entry.weight_kg) : "");
  const [sightingQueen, setSightingQueen] = useState(!!entry.sighting_queen);
  const [sightingLarvae, setSightingLarvae] = useState(!!entry.sighting_larvae);
  const [sightingEggs, setSightingEggs] = useState(!!entry.sighting_eggs);
  const [sightingBrood, setSightingBrood] = useState(!!entry.sighting_brood);
  const [occupiedCombs, setOccupiedCombs] = useState(entry.occupied_combs != null ? String(entry.occupied_combs) : "");
  const [queenCells, setQueenCells] = useState(entry.queen_cells != null ? String(entry.queen_cells) : "");
  const [varroaMites, setVarroaMites] = useState<"" | "ja" | "nein">(
    entry.varroa_mites === null || entry.varroa_mites === undefined ? "" : entry.varroa_mites ? "ja" : "nein"
  );
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
    // Wie beim Neuanlegen: Fotos vor dem Hochladen verkleinern (siehe imageCompression.ts).
    const compressedNewPhotos = newPhotos ? await compressImages(Array.from(newPhotos)) : [];

    try {
      if (isPending) {
        const localId = -entry.id;
        const total = entry.localPhotoUrls?.length || 0;
        const keepIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !removedIndices.includes(i));
        const newFiles = compressedNewPhotos.map((f) => ({ name: f.name, type: f.type, blob: f }));
        await updatePendingEntryFields(
          localId,
          {
            entryDate,
            notes,
            queenColor,
            queenYear,
            colonyStrength,
            varroa,
            feeding,
            weightKg,
            sightingQueen,
            sightingLarvae,
            sightingEggs,
            sightingBrood,
            occupiedCombs,
            queenCells,
            varroaMites,
          },
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
        form.set("sightingQueen", String(sightingQueen));
        form.set("sightingLarvae", String(sightingLarvae));
        form.set("sightingEggs", String(sightingEggs));
        form.set("sightingBrood", String(sightingBrood));
        form.set("occupiedCombs", occupiedCombs);
        form.set("queenCells", queenCells);
        form.set("varroaMites", varroaMites === "" ? "" : varroaMites === "ja" ? "true" : "false");
        const keepKeys = (entry.photo_keys || []).filter((k) => !removedKeys.includes(k));
        form.set("keepPhotoKeys", JSON.stringify(keepKeys));
        compressedNewPhotos.forEach((f) => form.append("photos", f));

        const res = await fetch(apiUrl("/api/entries"), { method: "PUT", body: form });
        if (!res.ok) throw new Error(await res.text());
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.genericSaveError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="entry-form edit-entry-form" onSubmit={handleSubmit}>
      <h2 className="entry-form-heading">{t.entryForm.editHeading}</h2>

      <div className="full-width">
        <span className="field-label">{t.entryForm.date}</span>
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
          {t.entryForm.queenYear}
          <QueenColorField value={queenYear} onChange={setQueenYear} />
        </label>

        <label>
          {t.entryForm.colonyStrength}
          <select value={colonyStrength} onChange={(e) => setColonyStrength(e.target.value)}>
            <option value="">{t.common.none}</option>
            <option value="schwach">{t.strengthLabels.schwach}</option>
            <option value="mittel">{t.strengthLabels.mittel}</option>
            <option value="stark">{t.strengthLabels.stark}</option>
          </select>
        </label>
      </div>

      <div className="sightings-section">
        <span className="color-picker-label">{t.entryForm.sightings}</span>

        <div className="sightings-checks">
          <label className="sighting-check">
            <input type="checkbox" checked={sightingQueen} onChange={(e) => setSightingQueen(e.target.checked)} />
            {t.entryForm.sightingQueen}
          </label>
          <label className="sighting-check">
            <input type="checkbox" checked={sightingLarvae} onChange={(e) => setSightingLarvae(e.target.checked)} />
            {t.entryForm.sightingLarvae}
          </label>
          <label className="sighting-check">
            <input type="checkbox" checked={sightingEggs} onChange={(e) => setSightingEggs(e.target.checked)} />
            {t.entryForm.sightingEggs}
          </label>
          <label className="sighting-check">
            <input type="checkbox" checked={sightingBrood} onChange={(e) => setSightingBrood(e.target.checked)} />
            {t.entryForm.sightingBrood}
          </label>
        </div>

        <div className="sightings-numbers">
          <label className="sighting-number">
            {t.entryForm.occupiedCombs}
            <input type="number" min={0} value={occupiedCombs} onChange={(e) => setOccupiedCombs(e.target.value)} />
          </label>
          <label className="sighting-number">
            {t.entryForm.queenCells}
            <input type="number" min={0} value={queenCells} onChange={(e) => setQueenCells(e.target.value)} />
          </label>
          <label className="sighting-number">
            {t.entryForm.varroaMites}
            <select value={varroaMites} onChange={(e) => setVarroaMites(e.target.value as "" | "ja" | "nein")}>
              <option value="">{t.common.none}</option>
              <option value="ja">{t.common.yes}</option>
              <option value="nein">{t.common.no}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="form-row">
        {varroaMites === "ja" && (
          <label>
            {t.entryForm.varroaTreatment}
            <input type="text" value={varroa} onChange={(e) => setVarroa(e.target.value)} />
          </label>
        )}

        <label>
          {t.entryForm.feeding}
          <input type="text" value={feeding} onChange={(e) => setFeeding(e.target.value)} />
        </label>

        <label>
          {t.entryForm.weight}
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
        {t.entryForm.notes}
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {!isPending && entry.photo_keys && entry.photo_keys.length > 0 && (
        <div className="full-width">
          <span className="field-label">{t.entryForm.existingPhotos}</span>
          <div className="entry-photos edit-photos">
            {entry.photo_keys.map((key) => {
              const removed = removedKeys.includes(key);
              return (
                <div key={key} className={`edit-photo-thumb ${removed ? "removed" : ""}`}>
                  <img src={apiUrl(`/api/photo?key=${key}`)} alt={t.entryList.photoAlt} />
                  <button
                    type="button"
                    className="remove-photo-btn"
                    onClick={() =>
                      setRemovedKeys((prev) => (removed ? prev.filter((k) => k !== key) : [...prev, key]))
                    }
                  >
                    {removed ? t.entryForm.restorePhoto : t.entryForm.removePhoto}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isPending && entry.localPhotoUrls && entry.localPhotoUrls.length > 0 && (
        <div className="full-width">
          <span className="field-label">{t.entryForm.existingPhotos}</span>
          <div className="entry-photos edit-photos">
            {entry.localPhotoUrls.map((url, i) => {
              const removed = removedIndices.includes(i);
              return (
                <div key={url} className={`edit-photo-thumb ${removed ? "removed" : ""}`}>
                  <img src={url} alt={t.entryList.photoAlt} />
                  <button
                    type="button"
                    className="remove-photo-btn"
                    onClick={() =>
                      setRemovedIndices((prev) => (removed ? prev.filter((idx) => idx !== i) : [...prev, i]))
                    }
                  >
                    {removed ? t.entryForm.restorePhoto : t.entryForm.removePhoto}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <label className="full-width">
        {t.entryForm.addMorePhotos}
        <input type="file" accept="image/*" multiple onChange={(e) => setNewPhotos(e.target.files)} />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="edit-form-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? t.common.saving : t.entryForm.saveChanges}
        </button>
      </div>
    </form>
  );
}
