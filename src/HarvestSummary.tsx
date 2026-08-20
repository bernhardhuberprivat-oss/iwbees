import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "./apiBase";
import { readableTextColor, hiveRingColor } from "./colorUtils";
import { HiveInfo } from "./types";
import { useT } from "./i18n";

interface Props {
  userId: number;
  hiveInfo: Record<number, HiveInfo>;
  onClose: () => void;
}

interface SummaryData {
  yearTotal: number;
  perHive: { hive: number; kg: number }[];
  gesamtOnlyKg: number;
  years: number[];
}

function hiveBadgeStyle(color?: string | null) {
  if (!color) return undefined;
  return { background: color, borderColor: hiveRingColor(color), color: readableTextColor(color) };
}

// Auswertung: öffnet sich beim Klick auf den Ertrags-Badge ("🍯 X kg (Jahr)") und zeigt
// für ein wählbares Jahr die Aufteilung nach Stock sowie separat die als "Gesamt"
// (ohne Stock-Zuordnung) erfassten Mengen.
export default function HarvestSummary({ userId, hiveInfo, onClose }: Props) {
  const t = useT();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/harvest-entries?userId=${userId}&year=${y}`));
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData({
        yearTotal: Number(json.yearTotal) || 0,
        perHive: json.perHive || [],
        gesamtOnlyKg: Number(json.gesamtOnlyKg) || 0,
        years: json.years || [],
      });
    } catch {
      setError(t.harvestSummary.loadError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    load(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Falls das aktuelle Jahr noch keine Erträge hat, aber andere Jahre schon, zumindest
  // das aktuelle Jahr immer als Option anbieten.
  const yearOptions = data && !data.years.includes(year) ? [year, ...data.years] : data?.years || [year];

  return (
    <div className="harvest-overlay" onClick={onClose}>
      <div className="harvest-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>

        <h2 className="harvest-panel-heading">{t.harvestSummary.heading}</h2>

        {yearOptions.length > 1 && (
          <div className="date-toggle harvest-mode-toggle">
            {yearOptions.map((y) => (
              <button key={y} type="button" className={y === year ? "active" : ""} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="muted">{t.harvestSummary.loading}</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : !data || (data.perHive.length === 0 && data.gesamtOnlyKg === 0) ? (
          <p className="muted">{t.harvestSummary.empty(year)}</p>
        ) : (
          <div className="harvest-summary">
            {data.perHive.length > 0 && (
              <div className="harvest-summary-list">
                {data.perHive.map(({ hive, kg }) => {
                  const info = hiveInfo[hive];
                  const label = info?.name?.trim() || t.common.hiveFallback(hive);
                  return (
                    <div className="harvest-summary-row" key={hive}>
                      <span className="hive-badge harvest-summary-label" style={hiveBadgeStyle(info?.color)}>
                        {label}
                      </span>
                      <span className="harvest-summary-kg">{kg.toFixed(1)} kg</span>
                    </div>
                  );
                })}
              </div>
            )}

            {data.gesamtOnlyKg > 0 && (
              <div className="harvest-summary-row">
                <span className="hive-badge harvest-summary-label">{t.harvestSummary.totalNoHive}</span>
                <span className="harvest-summary-kg">{data.gesamtOnlyKg.toFixed(1)} kg</span>
              </div>
            )}

            <div className="harvest-summary-total">{t.harvestSummary.yearTotal(year, data.yearTotal.toFixed(1))}</div>
          </div>
        )}
      </div>
    </div>
  );
}
