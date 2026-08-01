import { useEffect, useState } from "react";
import { COLOR_PALETTE, HIVE_CATEGORIES, Entry, HiveInfo } from "./types";
import QueenColorField from "./QueenColorField";
import StockChangeList from "./StockChangeList";

interface Props {
  hive: number;
  currentColor?: string | null;
  currentName?: string | null;
  currentCategory?: string | null;
  currentQueenYear?: number | null;
  currentColonyStrength?: string | null;
  currentWeightKg?: number | null;
  varroaMitesActive?: boolean;
  recentChanges?: Entry[];
  onDeleteChange?: (id: number) => void;
  onPickColor: (color: string | null) => void;
  onRename: (name: string | null) => void;
  onCategoryChange: (category: string | null) => void;
  onQueenYearChange: (year: number | null) => void;
  onColonyStrengthChange: (value: string | null) => void;
  onWeightChange: (value: number | null) => void;
}

export default function ColorPicker({
  hive,
  currentColor,
  currentName,
  currentCategory,
  currentQueenYear,
  currentColonyStrength,
  currentWeightKg,
  varroaMitesActive,
  recentChanges,
  onDeleteChange,
  onPickColor,
  onRename,
  onCategoryChange,
  onQueenYearChange,
  onColonyStrengthChange,
  onWeightChange,
}: Props) {
  const [name, setName] = useState(currentName || "");
  const [weightInput, setWeightInput] = useState(currentWeightKg != null ? String(currentWeightKg) : "");
  const [showRecentChanges, setShowRecentChanges] = useState(false);

  useEffect(() => {
    setName(currentName || "");
  }, [hive, currentName]);

  useEffect(() => {
    setWeightInput(currentWeightKg != null ? String(currentWeightKg) : "");
  }, [hive, currentWeightKg]);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed !== (currentName || "")) {
      onRename(trimmed || null);
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

      {varroaMitesActive && (
        <div className="varroa-status-badge" title="Wird im Tageseintrag erfasst, verschwindet automatisch bei Varroamilben = Nein">
          🔬 Varroamilben: Ja
        </div>
      )}

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
