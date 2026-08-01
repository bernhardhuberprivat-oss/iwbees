import { useEffect, useState } from "react";
import { COLOR_PALETTE, HIVE_CATEGORIES, Entry, HiveInfo } from "./types";
import QueenColorField from "./QueenColorField";
import StockChangeList from "./StockChangeList";

export interface SightingsPatch {
  sightingQueen?: boolean;
  sightingLarvae?: boolean;
  sightingEggs?: boolean;
  sightingBrood?: boolean;
  occupiedCombs?: number | null;
  queenCells?: number | null;
  varroaMites?: boolean | null;
}

interface Props {
  hive: number;
  currentColor?: string | null;
  currentName?: string | null;
  currentCategory?: string | null;
  currentQueenYear?: number | null;
  currentColonyStrength?: string | null;
  currentWeightKg?: number | null;
  sightingQueen?: boolean | null;
  sightingLarvae?: boolean | null;
  sightingEggs?: boolean | null;
  sightingBrood?: boolean | null;
  occupiedCombs?: number | null;
  queenCells?: number | null;
  varroaMites?: boolean | null;
  recentChanges?: Entry[];
  onDeleteChange?: (id: number) => void;
  onPickColor: (color: string | null) => void;
  onRename: (name: string | null) => void;
  onCategoryChange: (category: string | null) => void;
  onQueenYearChange: (year: number | null) => void;
  onColonyStrengthChange: (value: string | null) => void;
  onWeightChange: (value: number | null) => void;
  onSightingsChange: (patch: SightingsPatch) => void;
}

export default function ColorPicker({
  hive,
  currentColor,
  currentName,
  currentCategory,
  currentQueenYear,
  currentColonyStrength,
  currentWeightKg,
  sightingQueen,
  sightingLarvae,
  sightingEggs,
  sightingBrood,
  occupiedCombs,
  queenCells,
  varroaMites,
  recentChanges,
  onDeleteChange,
  onPickColor,
  onRename,
  onCategoryChange,
  onQueenYearChange,
  onColonyStrengthChange,
  onWeightChange,
  onSightingsChange,
}: Props) {
  const [name, setName] = useState(currentName || "");
  const [occupiedCombsInput, setOccupiedCombsInput] = useState(occupiedCombs != null ? String(occupiedCombs) : "");
  const [queenCellsInput, setQueenCellsInput] = useState(queenCells != null ? String(queenCells) : "");
  const [weightInput, setWeightInput] = useState(currentWeightKg != null ? String(currentWeightKg) : "");
  const [showRecentChanges, setShowRecentChanges] = useState(false);

  useEffect(() => {
    setName(currentName || "");
  }, [hive, currentName]);

  useEffect(() => {
    setOccupiedCombsInput(occupiedCombs != null ? String(occupiedCombs) : "");
  }, [hive, occupiedCombs]);

  useEffect(() => {
    setQueenCellsInput(queenCells != null ? String(queenCells) : "");
  }, [hive, queenCells]);

  useEffect(() => {
    setWeightInput(currentWeightKg != null ? String(currentWeightKg) : "");
  }, [hive, currentWeightKg]);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed !== (currentName || "")) {
      onRename(trimmed || null);
    }
  }

  function commitOccupiedCombs() {
    const value = occupiedCombsInput.trim() === "" ? null : Number(occupiedCombsInput);
    if (value !== (occupiedCombs ?? null)) {
      onSightingsChange({ occupiedCombs: value });
    }
  }

  function commitQueenCells() {
    const value = queenCellsInput.trim() === "" ? null : Number(queenCellsInput);
    if (value !== (queenCells ?? null)) {
      onSightingsChange({ queenCells: value });
    }
  }

  function commitWeight() {
    const value = weightInput.trim() === "" ? null : Number(weightInput);
    if (value !== (currentWeightKg ?? null)) {
      onWeightChange(value);
    }
  }

  return (
    <div className="color-picker" style={currentColor ? { borderColor: currentColor } : undefined}>
      <h2 className="stock-panel-heading">Stock-Stammdaten</h2>
      <p className="stock-panel-hint muted">
        Diese Angaben gelten dauerhaft für diesen Stock, bis du sie hier änderst.
      </p>

      <label className="hive-name-field">
        <span className="color-picker-label">Name für Stock {hive}:</span>
        <input
          type="text"
          value={name}
          placeholder={`Stock ${hive}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </label>

      <label className="hive-category-field">
        <span className="color-picker-label">Kategorie für Stock {hive}:</span>
        <select
          value={currentCategory || ""}
          onChange={(e) => onCategoryChange(e.target.value || null)}
        >
          <option value="">–</option>
          {HIVE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="hive-strength-field">
        <span className="color-picker-label">Volksstärke:</span>
        <select
          value={currentColonyStrength || ""}
          onChange={(e) => onColonyStrengthChange(e.target.value || null)}
        >
          <option value="">–</option>
          <option value="schwach">schwach</option>
          <option value="mittel">mittel</option>
          <option value="stark">stark</option>
        </select>
      </label>

      <label className="hive-weight-field">
        <span className="color-picker-label">Stockgewicht (kg):</span>
        <input
          type="number"
          step="0.1"
          min="0"
          placeholder="z.B. 24.5"
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          onBlur={commitWeight}
        />
      </label>

      <div className="hive-queen-field">
        <span className="color-picker-label">Königin (Zuchtjahr):</span>
        <QueenColorField value={currentQueenYear ?? null} onChange={onQueenYearChange} />
      </div>

      <div className="color-swatch-row">
        <span className="color-picker-label">Stock {hive} markieren:</span>
        <div className="color-swatches">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`swatch ${currentColor === c.value ? "selected" : ""}`}
              style={{ background: c.value }}
              title={c.name}
              aria-label={c.name}
              onClick={() => onPickColor(c.value)}
            />
          ))}
          <button
            type="button"
            className={`swatch clear ${!currentColor ? "selected" : ""}`}
            title="Keine Markierung"
            aria-label="Keine Markierung"
            onClick={() => onPickColor(null)}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="sightings-section">
        <span className="color-picker-label">Sichtungen:</span>

        <div className="sightings-checks">
          <label className="sighting-check">
            <input
              type="checkbox"
              checked={!!sightingQueen}
              onChange={(e) => onSightingsChange({ sightingQueen: e.target.checked })}
            />
            Königin
          </label>
          <label className="sighting-check">
            <input
              type="checkbox"
              checked={!!sightingLarvae}
              onChange={(e) => onSightingsChange({ sightingLarvae: e.target.checked })}
            />
            Larven
          </label>
          <label className="sighting-check">
            <input
              type="checkbox"
              checked={!!sightingEggs}
              onChange={(e) => onSightingsChange({ sightingEggs: e.target.checked })}
            />
            Stifte
          </label>
          <label className="sighting-check">
            <input
              type="checkbox"
              checked={!!sightingBrood}
              onChange={(e) => onSightingsChange({ sightingBrood: e.target.checked })}
            />
            Brut
          </label>
        </div>

        <div className="sightings-numbers">
          <label className="sighting-number">
            Besetzte Waben
            <input
              type="number"
              min={0}
              value={occupiedCombsInput}
              onChange={(e) => setOccupiedCombsInput(e.target.value)}
              onBlur={commitOccupiedCombs}
            />
          </label>
          <label className="sighting-number">
            Weiselzellen
            <input
              type="number"
              min={0}
              value={queenCellsInput}
              onChange={(e) => setQueenCellsInput(e.target.value)}
              onBlur={commitQueenCells}
            />
          </label>
          <label className="sighting-number">
            Varroamilben
            <select
              value={varroaMites === null || varroaMites === undefined ? "" : varroaMites ? "ja" : "nein"}
              onChange={(e) => {
                const v = e.target.value;
                onSightingsChange({ varroaMites: v === "" ? null : v === "ja" });
              }}
            >
              <option value="">–</option>
              <option value="ja">Ja</option>
              <option value="nein">Nein</option>
            </select>
          </label>
        </div>
      </div>

      <div className="recent-changes">
        <button
          type="button"
          className="recent-changes-toggle"
          onClick={() => setShowRecentChanges((v) => !v)}
        >
          Letzte Änderungen {showRecentChanges ? "▲" : "▼"}
        </button>

        {showRecentChanges && (
          <div className="recent-changes-panel">
            <div className="recent-changes-panel-header">
              <span>Letzte Änderungen</span>
              <button
                type="button"
                className="recent-changes-close"
                onClick={() => setShowRecentChanges(false)}
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <StockChangeList
              entries={recentChanges || []}
              loading={false}
              onDelete={onDeleteChange || (() => {})}
              hiveInfo={{} as Record<number, HiveInfo>}
              hideHiveBadge
              compact
              emptyMessage="Noch keine Änderungen."
            />
          </div>
        )}
      </div>
    </div>
  );
}
