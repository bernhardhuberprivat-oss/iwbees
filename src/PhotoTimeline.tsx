import { useEffect, useState } from "react";
import { Entry } from "./types";
import { apiUrl } from "./apiBase";
import { useT, useLang, dateLocale } from "./i18n";

// Zeigt alle Fotos eines Stocks chronologisch (neueste zuerst, passend zur restlichen
// App) statt verstreut in einzelnen Tageseintrags-Karten - erreichbar über den
// "hive-actions-bar"-Button (Diary in App.tsx). Bekommt bewusst die bereits geladenen,
// gefilterten entries des aktuell ausgewählten Stocks übergeben (kein eigener
// API-Aufruf nötig, die Daten liegen in Diary schon vor).
interface Props {
  hiveLabel: string;
  entries: Entry[];
  onClose: () => void;
}

export default function PhotoTimeline({ hiveLabel, entries, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (lightboxUrl) setLightboxUrl(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, lightboxUrl]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(dateLocale(lang));
  }

  const withPhotos = entries.filter(
    (e) => (e.pending && e.localPhotoUrls && e.localPhotoUrls.length > 0) || (!e.pending && e.photo_keys?.length > 0)
  );

  return (
    <>
      <div className="photo-timeline-overlay" onClick={onClose}>
        <div className="photo-timeline-panel" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="harvest-panel-close" onClick={onClose} aria-label={t.common.close}>
            ✕
          </button>

          <h2 className="harvest-panel-heading">{t.photoTimeline.heading(hiveLabel)}</h2>

          {withPhotos.length === 0 ? (
            <p className="muted">{t.photoTimeline.empty}</p>
          ) : (
            <div className="photo-timeline-list">
              {withPhotos.map((entry) => {
                const urls = entry.pending
                  ? entry.localPhotoUrls || []
                  : entry.photo_keys.map((key) => apiUrl(`/api/photo?key=${key}`));
                return (
                  <div className="photo-timeline-entry" key={entry.id}>
                    <div className="photo-timeline-date">{formatDate(entry.entry_date)}</div>
                    <div className="entry-photos">
                      {urls.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt={t.entryList.photoAlt}
                          className="entry-photo-thumb"
                          onClick={() => setLightboxUrl(url)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
          <img
            className="lightbox-img"
            src={lightboxUrl}
            alt={t.entryList.lightboxAlt}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
