import { useEffect } from "react";
import { useT } from "./i18n";

// Kurze Anleitung, wie man isybee als App-Symbol auf den Homescreen bekommt (iOS Safari
// "Zum Home-Bildschirm" bzw. Android Chrome "App installieren") - kein nativer App-Store-
// Download, einfach die PWA-Installationsschritte, plattformabhängig weil beide Browser
// das an unterschiedlicher Stelle im UI verstecken. Aufgerufen über einen Link im
// Willkommens-Bildschirm (Welcome.tsx, für neue Besucher:innen z. B. über den
// WhatsApp-QR-Code) und im Footer der Diary-Ansicht (Diary in App.tsx, für bereits
// registrierte Nutzer:innen, die die App bisher nur im Browser-Tab offen haben).
interface Props {
  onClose: () => void;
}

export default function InstallGuide({ onClose }: Props) {
  const t = useT();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="install-guide-overlay" onClick={onClose}>
      <div className="install-guide-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>

        <h2 className="harvest-panel-heading">{t.installGuide.heading}</h2>
        <p className="muted install-guide-intro">{t.installGuide.intro}</p>

        <div className="install-guide-platform">
          <h3>{t.installGuide.iosTitle}</h3>
          <ol className="install-guide-steps">
            <li>{t.installGuide.iosStep1}</li>
            <li>{t.installGuide.iosStep2}</li>
            <li>{t.installGuide.iosStep3}</li>
            <li>{t.installGuide.iosStep4}</li>
          </ol>
        </div>

        <div className="install-guide-platform">
          <h3>{t.installGuide.androidTitle}</h3>
          <ol className="install-guide-steps">
            <li>{t.installGuide.androidStep1}</li>
            <li>{t.installGuide.androidStep2}</li>
            <li>{t.installGuide.androidStep3}</li>
            <li>{t.installGuide.androidStep4}</li>
          </ol>
        </div>

        <p className="muted install-guide-outro">{t.installGuide.outro}</p>
      </div>
    </div>
  );
}
