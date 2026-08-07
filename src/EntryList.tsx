import { useEffect, useState } from "react";
import { Entry, HiveInfo } from "./types";
import { readableTextColor } from "./colorUtils";
import EditEntryForm from "./EditEntryForm";
import { apiUrl } from "./apiBase";

interface Props {
  entries: Entry[];
  loading: boolean;
  userId: number;
  onDelete: (id: number) => void;
  onUpdated: () => void;
  hiveInfo: Record<number, HiveInfo>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("de-DE");
}

export default function EntryList({ entries, loading, userId, onDelete, onUpdated, hiveInfo }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxUrl]);

  if (loading) return <p className="muted">Lade Einträge…</p>;
  if (entries.length === 0) return <p className="muted">Noch keine Einträge.</p>;

  return (
    <div className="entry-list">
      {entries.map((entry) => {
        const info = hiveInfo[entry.hive];
        const hiveColor = info?.color;
        const hiveLabel = info?.name?.trim() || `Stock ${entry.hive}`;
        const hiveCategory = info?.category;
        const badgeStyle = hiveColor
          ? { background: hiveColor, color: readableTextColor(hiveColor) }
          : undefined;

        if (editingId === entry.id) {
          return (
            <div className="entry-card" key={entry.id}>
              <div className="entry-card-header">
                <span className="hive-badge" style={badgeStyle}>{hiveLabel}</span>
                {hiveCategory && <span className="category-badge">{hiveCategory}</span>}
                <span className="entry-date">{formatDate(entry.entry_date)}</span>
              </div>
              <EditEntryForm
                entry={entry}
                userId={userId}
                onSaved={() => {
                  setEditingId(null);
                  onUpdated();
                }}
                onCancel={() => setEditingId(null)}
              />
            </div>
          );
        }

        return (
        <div className="entry-card" key={entry.id}>
          <div className="entry-card-header">
            <span className="hive-badge" style={badgeStyle}>{hiveLabel}</span>
            {hiveCategory && <span className="category-badge">{hiveCategory}</span>}
            <span className="entry-date">{formatDate(entry.entry_date)}</span>
            {entry.pending && <span className="pending-badge">⏳ wird synchronisiert</span>}
            <div className="entry-actions">
              <button className="edit-btn" onClick={() => setEditingId(entry.id)} title="Bearbeiten">
                ✎
              </button>
              <button className="delete-btn" onClick={() => onDelete(entry.id)} title="Löschen">
                ✕
              </button>
            </div>
          </div>

          <div className="entry-meta">
            {entry.queen_color && (
              <span>
                👑 Königin{entry.queen_year ? ` ${entry.queen_year}` : ""}:{" "}
                <span className="queen-dot" style={{ background: entry.queen_color }} />
              </span>
            )}
            {entry.colony_strength && <span>🐝 {entry.colony_strength}</span>}
            {entry.varroa && <span>🔬 Varroa: {entry.varroa}</span>}
            {entry.feeding && <span>🍯 Fütterung: {entry.feeding}</span>}
            {entry.weight_kg && <span>⚖️ Stockgewicht: {entry.weight_kg} kg</span>}
          </div>

          {(() => {
            const seen = [
              entry.sighting_queen && "Königin",
              entry.sighting_larvae && "Larven",
              entry.sighting_eggs && "Stifte",
              entry.sighting_brood && "Brut",
            ].filter(Boolean);
            const hasSightingInfo =
              seen.length > 0 || entry.occupied_combs != null || entry.queen_cells != null || entry.varroa_mites != null;
            if (!hasSightingInfo) return null;
            return (
              <div className="entry-meta entry-sightings">
                {seen.length > 0 && <span>👁️ Sichtungen: {seen.join(", ")}</span>}
                {entry.occupied_combs != null && <span>🧱 Waben: {entry.occupied_combs}</span>}
                {entry.queen_cells != null && <span>👑 Weiselzellen: {entry.queen_cells}</span>}
                {entry.varroa_mites != null && <span>🔬 Varroamilben: {entry.varroa_mites ? "Ja" : "Nein"}</span>}
              </div>
            );
          })()}

          {entry.notes && <p className="entry-notes">{entry.notes}</p>}

          {entry.pending
            ? entry.localPhotoUrls && entry.localPhotoUrls.length > 0 && (
                <div className="entry-photos">
                  {entry.localPhotoUrls.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="Stockkontrolle"
                      className="entry-photo-thumb"
                      onClick={() => setLightboxUrl(url)}
                    />
                  ))}
                </div>
              )
            : entry.photo_keys?.length > 0 && (
                <div className="entry-photos">
                  {entry.photo_keys.map((key) => (
                    <img
                      key={key}
                      src={apiUrl(`/api/photo?key=${key}`)}
                      alt="Stockkontrolle"
                      className="entry-photo-thumb"
                      onClick={() => setLightboxUrl(apiUrl(`/api/photo?key=${key}`))}
                    />
                  ))}
                </div>
              )}
        </div>
        );
      })}

      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setLightboxUrl(null)}
            aria-label="Schließen"
          >
            ✕
          </button>
          <img className="lightbox-img" src={lightboxUrl} alt="Foto vergrößert" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
