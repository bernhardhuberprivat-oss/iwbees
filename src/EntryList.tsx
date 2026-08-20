import { useEffect, useState } from "react";
import { Entry, HiveInfo } from "./types";
import { readableTextColor } from "./colorUtils";
import EditEntryForm from "./EditEntryForm";
import { apiUrl } from "./apiBase";
import { useT, useLang, dateLocale } from "./i18n";

interface Props {
  entries: Entry[];
  loading: boolean;
  userId: number;
  onDelete: (id: number) => void;
  onUpdated: () => void;
  hiveInfo: Record<number, HiveInfo>;
}

export default function EntryList({ entries, loading, userId, onDelete, onUpdated, hiveInfo }: Props) {
  const t = useT();
  const { lang } = useLang();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(dateLocale(lang));
  }

  useEffect(() => {
    if (!lightboxUrl) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxUrl]);

  if (loading) return <p className="muted">{t.entryList.loading}</p>;
  if (entries.length === 0) return <p className="muted">{t.entryList.empty}</p>;

  return (
    <div className="entry-list">
      {entries.map((entry) => {
        const info = hiveInfo[entry.hive];
        const hiveColor = info?.color;
        const hiveLabel = info?.name?.trim() || t.common.hiveFallback(entry.hive);
        const hiveCategory = info?.category ? t.categories[info.category] ?? info.category : undefined;
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
            {entry.pending && <span className="pending-badge">{t.entryList.syncPending}</span>}
            <div className="entry-actions">
              <button className="edit-btn" onClick={() => setEditingId(entry.id)} title={t.common.edit}>
                ✎
              </button>
              <button className="delete-btn" onClick={() => onDelete(entry.id)} title={t.common.delete}>
                ✕
              </button>
            </div>
          </div>

          <div className="entry-meta">
            {entry.queen_color && (
              <span>
                {t.entryList.queen(entry.queen_year)}{" "}
                <span className="queen-dot" style={{ background: entry.queen_color }} />
              </span>
            )}
            {entry.colony_strength && (
              <span>{t.entryList.strength(t.strengthLabels[entry.colony_strength] ?? entry.colony_strength)}</span>
            )}
            {entry.varroa && <span>{t.entryList.varroa(entry.varroa)}</span>}
            {entry.feeding && <span>{t.entryList.feeding(entry.feeding)}</span>}
            {entry.weight_kg && <span>{t.entryList.weight(entry.weight_kg)}</span>}
          </div>

          {(() => {
            const seen = [
              entry.sighting_queen && t.entryForm.sightingQueen,
              entry.sighting_larvae && t.entryForm.sightingLarvae,
              entry.sighting_eggs && t.entryForm.sightingEggs,
              entry.sighting_brood && t.entryForm.sightingBrood,
            ].filter(Boolean) as string[];
            const hasSightingInfo =
              seen.length > 0 || entry.occupied_combs != null || entry.queen_cells != null || entry.varroa_mites != null;
            if (!hasSightingInfo) return null;
            return (
              <div className="entry-meta entry-sightings">
                {seen.length > 0 && <span>{t.entryList.sightingsLabel(seen.join(", "))}</span>}
                {entry.occupied_combs != null && <span>{t.entryList.combs(entry.occupied_combs)}</span>}
                {entry.queen_cells != null && <span>{t.entryList.cells(entry.queen_cells)}</span>}
                {entry.varroa_mites != null && <span>{t.entryList.mites(entry.varroa_mites)}</span>}
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
                      alt={t.entryList.photoAlt}
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
                      alt={t.entryList.photoAlt}
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
            aria-label={t.common.close}
          >
            ✕
          </button>
          <img className="lightbox-img" src={lightboxUrl} alt={t.entryList.lightboxAlt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
