import { useState, FormEvent } from "react";
import DatePicker from "./DatePicker";
import { addPendingEntry } from "./offline";
import { compressImages } from "./imageCompression";
import { readableTextColor } from "./colorUtils";
import { getQueenColorForYear } from "./types";
import { apiUrl } from "./apiBase";
import { useT, useLang, dateLocale } from "./i18n";

interface Props {
  userId: number;
  hive: number;
  hiveColor?: string;
  hiveName?: string;
  queenYear: number | null;
  colonyStrength: string | null;
  onCreated: () => void;
  onClose?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function NewEntryForm({
  userId,
  hive,
  hiveColor,
  hiveName,
  queenYear,
  colonyStrength,
  onCreated,
  onClose,
}: Props) {
  const t = useT();
  const { lang } = useLang();

  function formatDisplay(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(dateLocale(lang), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const [entryDate, setEntryDate] = useState(today());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [varroa, setVarroa] = useState("");
  const [feeding, setFeeding] = useState("");
  const [sightingQueen, setSightingQueen] = useState(false);
  const [sightingLarvae, setSightingLarvae] = useState(false);
  const [sightingEggs, setSightingEggs] = useState(false);
  const [sightingBrood, setSightingBrood] = useState(false);
  const [occupiedCombs, setOccupiedCombs] = useState("");
  const [queenCells, setQueenCells] = useState("");
  const [varroaMites, setVarroaMites] = useState<"" | "ja" | "nein">("");
  const [weightKg, setWeightKg] = useState("");
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [flying, setFlying] = useState(false);

  const queenColorInfo = getQueenColorForYear(queenYear);

  function triggerBeeFlight() {
    setFlying(true);
    setTimeout(() => setFlying(false), 1300);
  }

  function resetForm() {
    setEntryDate(today());
    setShowDatePicker(false);
    setNotes("");
    setVarroa("");
    setFeeding("");
    setSightingQueen(false);
    setSightingLarvae(false);
    setSightingEggs(false);
    setSightingBrood(false);
    setOccupiedCombs("");
    setQueenCells("");
    setVarroaMites("");
    setWeightKg("");
    setPhotos(null);
    (document.getElementById("photo-input") as HTMLInputElement | null)?.value &&
      ((document.getElementById("photo-input") as HTMLInputElement).value = "");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setInfo("");
    // Fotos vor dem Hochladen verkleinern - unkomprimierte iPhone-Fotos können sonst am
    // ~6-MB-Anfragelimit der Netlify Function scheitern (siehe imageCompression.ts).
    const photoList = photos ? await compressImages(Array.from(photos)) : [];
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
      form.set("weightKg", weightKg);
      form.set("sightingQueen", String(sightingQueen));
      form.set("sightingLarvae", String(sightingLarvae));
      form.set("sightingEggs", String(sightingEggs));
      form.set("sightingBrood", String(sightingBrood));
      form.set("occupiedCombs", occupiedCombs);
      form.set("queenCells", queenCells);
      form.set("varroaMites", varroaMites === "" ? "" : varroaMites === "ja" ? "true" : "false");
      photoList.forEach((file) => form.append("photos", file));

      const res = await fetch(apiUrl("/api/entries"), { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());

      triggerBeeFlight();
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
            weightKg,
            sightingQueen,
            sightingLarvae,
            sightingEggs,
            sightingBrood,
            occupiedCombs,
            queenCells,
            varroaMites,
            photos: photoList.map((f) => ({ name: f.name, type: f.type, blob: f })),
          });
          setInfo(t.entryForm.offlineSaved);
          triggerBeeFlight();
          resetForm();
          onCreated();
        } catch {
          setError(t.entryForm.saveFailedTotal);
        }
      } else {
        setError(err instanceof Error ? err.message : t.common.genericSaveError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const hiveLabel = hiveName || t.common.hiveFallback(hive);

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <h2
        className="entry-form-heading"
        style={hiveColor ? { background: hiveColor, color: readableTextColor(hiveColor) } : undefined}
      >
        {t.entryForm.newEntryHeading(hiveLabel)}
        {onClose && (
          <button
            type="button"
            className="entry-form-close"
            onClick={onClose}
            aria-label={t.entryForm.closeNoSave}
            title={t.entryForm.closeNoSave}
          >
            ✕
          </button>
        )}
      </h2>

      <div className="full-width">
        <span className="field-label">{t.entryForm.date}</span>
        <div className="date-toggle">
          <button
            type="button"
            className={entryDate === today() ? "active" : ""}
            onClick={() => {
              setEntryDate(today());
              setShowDatePicker(false);
            }}
          >
            {t.entryForm.today(formatDisplay(today()))}
          </button>
          <button
            type="button"
            className={entryDate !== today() ? "active" : ""}
            onClick={() => setShowDatePicker((v) => !v)}
          >
            {t.entryForm.customDate(formatDisplay(entryDate), entryDate !== today())}
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
            <input
              type="number"
              min={0}
              value={occupiedCombs}
              onChange={(e) => setOccupiedCombs(e.target.value)}
            />
          </label>
          <label className="sighting-number">
            {t.entryForm.queenCells}
            <input
              type="number"
              min={0}
              value={queenCells}
              onChange={(e) => setQueenCells(e.target.value)}
            />
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
            <input
              type="text"
              placeholder={t.entryForm.varroaTreatmentPlaceholder}
              value={varroa}
              onChange={(e) => setVarroa(e.target.value)}
            />
          </label>
        )}

        <label>
          {t.entryForm.feeding}
          <input
            type="text"
            placeholder={t.entryForm.feedingPlaceholder}
            value={feeding}
            onChange={(e) => setFeeding(e.target.value)}
          />
        </label>

        <label>
          {t.entryForm.weight}
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder={t.entryForm.weightPlaceholder}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </label>
      </div>

      <label className="full-width">
        {t.entryForm.notes}
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <label className="full-width">
        {t.entryForm.photos}
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

      <div className="submit-row">
        <button type="submit" disabled={submitting}>
          {submitting ? t.common.saving : t.entryForm.saveEntry}
        </button>
        {flying && (
          <span className="flying-bee" aria-hidden="true">
            🐝
          </span>
        )}
      </div>
    </form>
  );
}
