import { Entry, HiveInfo } from "./types";
import { readableTextColor } from "./colorUtils";
import { useT, useLang, dateLocale } from "./i18n";

interface Props {
  entries: Entry[];
  loading: boolean;
  onDelete: (id: number) => void;
  hiveInfo: Record<number, HiveInfo>;
  hideHiveBadge?: boolean;
  compact?: boolean;
  emptyMessage?: string;
}

// Zeigt Stammdaten-Änderungen kompakt gruppiert nach Tag an, statt als volle Eintragskarten -
// an einem Tag können mehrere Stöcke geändert worden sein, das soll auf einen Blick lesbar sein.
export default function StockChangeList({
  entries,
  loading,
  onDelete,
  hiveInfo,
  hideHiveBadge,
  compact,
  emptyMessage,
}: Props) {
  const t = useT();
  const { lang } = useLang();

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(dateLocale(lang));
  }

  if (loading) return <p className="muted">{t.stockChangeList.loading}</p>;
  if (entries.length === 0) return <p className="muted">{emptyMessage || t.stockChangeList.empty}</p>;

  const groups: { date: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.entry_date) {
      last.entries.push(entry);
    } else {
      groups.push({ date: entry.entry_date, entries: [entry] });
    }
  }

  return (
    <div className={`change-log ${compact ? "change-log-compact" : ""}`}>
      {groups.map((group) => (
        <div className="change-log-day" key={group.date}>
          <h3 className="change-log-date">{formatDate(group.date)}</h3>
          {group.entries.map((entry) => {
            const info = hiveInfo[entry.hive];
            const hiveColor = info?.color;
            const hiveLabel = info?.name?.trim() || t.common.hiveFallback(entry.hive);
            const badgeStyle = hiveColor
              ? { background: hiveColor, color: readableTextColor(hiveColor) }
              : undefined;
            // Erste Zeile der Notiz ist der Titel mit dem Datum - das steht schon in der
            // Tages-Überschrift, deshalb hier nur die eigentlichen Änderungszeilen anzeigen.
            const lines = (entry.notes || "").split("\n").slice(1).filter(Boolean);

            return (
              <div className="change-log-entry" key={entry.id}>
                <div className="change-log-entry-header">
                  {!hideHiveBadge && (
                    <span className="hive-badge" style={badgeStyle}>
                      {hiveLabel}
                    </span>
                  )}
                  <button className="delete-btn" onClick={() => onDelete(entry.id)} title={t.common.delete}>
                    ✕
                  </button>
                </div>
                {lines.length > 0 && (
                  <ul className="change-log-lines">
                    {lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
