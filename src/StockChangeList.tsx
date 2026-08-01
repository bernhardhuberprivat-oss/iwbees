import { Entry, HiveInfo } from "./types";
import { readableTextColor } from "./colorUtils";

interface Props {
  entries: Entry[];
  loading: boolean;
  onDelete: (id: number) => void;
  hiveInfo: Record<number, HiveInfo>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("de-DE");
}

// Zeigt Stammdaten-Änderungen kompakt gruppiert nach Tag an, statt als volle Eintragskarten -
// an einem Tag können mehrere Stöcke geändert worden sein, das soll auf einen Blick lesbar sein.
export default function StockChangeList({ entries, loading, onDelete, hiveInfo }: Props) {
  if (loading) return <p className="muted">Lade Änderungen…</p>;
  if (entries.length === 0) return <p className="muted">Noch keine Änderungen an den Stammdaten.</p>;

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
    <div className="change-log">
      {groups.map((group) => (
        <div className="change-log-day" key={group.date}>
          <h3 className="change-log-date">{formatDate(group.date)}</h3>
          {group.entries.map((entry) => {
            const info = hiveInfo[entry.hive];
            const hiveColor = info?.color;
            const hiveLabel = info?.name?.trim() || `Stock ${entry.hive}`;
            const badgeStyle = hiveColor
              ? { background: hiveColor, color: readableTextColor(hiveColor) }
              : undefined;
            // Erste Zeile der Notiz ist der Titel mit dem Datum - das steht schon in der
            // Tages-Überschrift, deshalb hier nur die eigentlichen Änderungszeilen anzeigen.
            const lines = (entry.notes || "").split("\n").slice(1).filter(Boolean);

            return (
              <div className="change-log-entry" key={entry.id}>
                <div className="change-log-entry-header">
                  <span className="hive-badge" style={badgeStyle}>
                    {hiveLabel}
                  </span>
                  <button className="delete-btn" onClick={() => onDelete(entry.id)} title="Löschen">
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
