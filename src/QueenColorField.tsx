import { getQueenColorForYear } from "./types";
import { useT } from "./i18n";

interface Props {
  value: number | null;
  onChange: (year: number | null) => void;
}

export default function QueenColorField({ value, onChange }: Props) {
  const t = useT();
  const color = getQueenColorForYear(value);
  const swatchFill = color ? color.hex : "#eee6d3";
  const swatchBorder = color ? "#2a1c0d" : "#c9bb9a";
  const colorLabel = color ? t.colorNames[color.name] ?? color.name : null;

  return (
    <div className="queen-year-field">
      <span className="queen-year-caption">{t.queenColorField.yearLabel}</span>

      <input
        type="number"
        inputMode="numeric"
        placeholder={t.queenColorField.placeholder}
        min={2000}
        max={2100}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? Number(v) : null);
        }}
      />

      <span className="queen-bee-icon" aria-hidden="true">
        <svg viewBox="0 0 36 32" width="30" height="27">
          {/* Flügel */}
          <ellipse
            cx="11"
            cy="13"
            rx="8"
            ry="5.5"
            fill="rgba(255,255,255,0.65)"
            stroke="#cbb98a"
            strokeWidth="0.6"
            transform="rotate(-20 11 13)"
          />
          <ellipse
            cx="25"
            cy="13"
            rx="8"
            ry="5.5"
            fill="rgba(255,255,255,0.65)"
            stroke="#cbb98a"
            strokeWidth="0.6"
            transform="rotate(20 25 13)"
          />
          {/* Hinterleib */}
          <ellipse cx="18" cy="22" rx="10" ry="8.5" fill="#f5c343" stroke="#3a2a1a" strokeWidth="1.4" />
          <path d="M9 18 Q18 15 27 18" stroke="#3a2a1a" strokeWidth="2" fill="none" />
          <path d="M8.3 24 Q18 28 27.7 24" stroke="#3a2a1a" strokeWidth="2" fill="none" />
          {/* Kopf */}
          <circle cx="18" cy="9.5" r="4.6" fill="#3a2a1a" />
          {/* Krone (Königin) */}
          <path
            d="M13.2 5.6 L14.6 1.4 L18 4.3 L21.4 1.4 L22.8 5.6 Z"
            fill="#ffd54a"
            stroke="#a5790a"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <span
        className="queen-color-swatch"
        style={{ background: swatchFill, borderColor: swatchBorder }}
        title={colorLabel ? t.queenColorField.titleWithColor(colorLabel) : t.queenColorField.titleNoColor}
      />
      <span className="queen-color-label">{colorLabel || t.common.none}</span>
    </div>
  );
}
