import { useEffect, useState } from "react";
import { COLOR_PALETTE, HIVE_CATEGORIES, Entry, HiveInfo } from "./types";
import QueenColorField from "./QueenColorField";
import StockChangeList from "./StockChangeList";
import { useT } from "./i18n";

interface Props {
  hive: number;
  currentColor?: string | null;
  currentName?: string | null;
  currentCategory?: string | null;
  currentQueenYear?: number | null;
  currentColonyStrength?: string | null;
  varroaMitesActive?: boolean;
  latestWeightKg?: number | null;
  recentChanges?: Entry[];
  onDeleteChange?: (id: number) => void;
  onPickColor: (color: string | null) => void;
  onRename: (name: string | null) => void;
  onCategoryChange: (category: string | null) => void;
  onQueenYearChange: (year: number | null) => void;
  onColonyStrengthChange: (value: string | null) => void;
}

export default function ColorPicker({
  hive,
  currentColor,
  currentName,
  currentCategory,
  currentQueenYear,
  currentColonyStrength,
  varroaMitesActive,
  latestWeightKg,
  recentChanges,
  onDeleteChange,
  onPickColor,
  onRename,
  onCategoryChange,
  onQueenYearChange,
  onColonyStrengthChange,
}: Props) {
  const t = useT();
  const [name, setName] = useState(currentName || "");
  const [showRecentChanges, setShowRecentChanges] = useState(false);

  useEffect(() => {
    setName(currentName || "");
  }, [hive, currentName]);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed !== (currentName || "")) {
      onRename(trimmed || null);
    }
  }

  return (
    <div className="color-picker" style={currentColor ? { borderColor: currentColor } : undefined}>
      <h2 className="stock-panel-heading">{t.colorPicker.heading}</h2>
      <p className="stock-panel-hint muted">{t.colorPicker.hint}</p>

      <label className="hive-name-field">
        <span className="color-picker-label">{t.colorPicker.nameLabel(hive)}</span>
        <input
          type="text"
          value={name}
          placeholder={t.common.hiveFallback(hive)}
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
        <span className="color-picker-label">{t.colorPicker.categoryLabel(hive)}</span>
        <select
          value={currentCategory || ""}
          onChange={(e) => onCategoryChange(e.target.value || null)}
        >
          <option value="">{t.common.none}</option>
          {HIVE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.categories[c] ?? c}
            </option>
          ))}
        </select>
      </label>

      <label className="hive-strength-field">
        <span className="color-picker-label">{t.colorPicker.strengthLabel}</span>
        <select
          value={currentColonyStrength || ""}
          onChange={(e) => onColonyStrengthChange(e.target.value || null)}
        >
          <option value="">{t.common.none}</option>
          <option value="schwach">{t.strengthLabels.schwach}</option>
          <option value="mittel">{t.strengthLabels.mittel}</option>
          <option value="stark">{t.strengthLabels.stark}</option>
        </select>
      </label>

      <div className="hive-queen-field">
        <span className="color-picker-label">{t.colorPicker.queenLabel}</span>
        <QueenColorField value={currentQueenYear ?? null} onChange={onQueenYearChange} />
      </div>

      <div className="status-badges">
        {varroaMitesActive && (
          <div className="varroa-status-badge" title={t.colorPicker.varroaBadgeTitle}>
            {t.colorPicker.varroaBadge}
          </div>
        )}
        {latestWeightKg != null && (
          <div className="weight-status-badge" title={t.colorPicker.weightBadgeTitle}>
            {t.colorPicker.weightBadge(latestWeightKg)}
          </div>
        )}
      </div>

      <div className="color-swatch-row">
        <span className="color-picker-label">{t.colorPicker.markLabel(hive)}</span>
        <div className="color-swatches">
          {COLOR_PALETTE.map((c) => {
            const colorLabel = t.colorNames[c.name] ?? c.name;
            return (
              <button
                key={c.value}
                type="button"
                className={`swatch ${currentColor === c.value ? "selected" : ""}`}
                style={{ background: c.value }}
                title={colorLabel}
                aria-label={colorLabel}
                onClick={() => onPickColor(c.value)}
              />
            );
          })}
          <button
            type="button"
            className={`swatch clear ${!currentColor ? "selected" : ""}`}
            title={t.colorPicker.noMark}
            aria-label={t.colorPicker.noMark}
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
          {t.colorPicker.recentChanges} {showRecentChanges ? "▲" : "▼"}
        </button>

        {showRecentChanges && (
          <div className="recent-changes-panel">
            <div className="recent-changes-panel-header">
              <span>{t.colorPicker.recentChanges}</span>
              <button
                type="button"
                className="recent-changes-close"
                onClick={() => setShowRecentChanges(false)}
                aria-label={t.common.close}
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
              emptyMessage={t.colorPicker.noChanges}
            />
          </div>
        )}
      </div>
    </div>
  );
}
