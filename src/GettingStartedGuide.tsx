import { useEffect } from "react";
import { useT } from "./i18n";

// Kurzer, sehr einfach gehaltener Einstiegs-Guide fuer Neueinsteiger:innen - erklaert
// in drei Schritten den Kernablauf der App (Stockanzahl -> Stoecke anlegen/benennen ->
// Tagebucheintraege). Erreichbar ueber das Kopfzeilen-Menue (App.tsx, Diary-Komponente),
// fuer Web UND native gleichermassen sichtbar (anders als InstallGuide, das ist reine
// App-Bedienung, keine plattformspezifische Installation).
interface Props {
  onClose: () => void;
}

export default function GettingStartedGuide({ onClose }: Props) {
  const t = useT();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="getting-started-overlay" onClick={onClose}>
      <div className="getting-started-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>

        <h2 className="harvest-panel-heading">{t.gettingStarted.heading}</h2>
        <p className="muted getting-started-intro">{t.gettingStarted.intro}</p>

        <div className="getting-started-step">
          <h3>{t.gettingStarted.step1Title}</h3>
          <p>{t.gettingStarted.step1Text}</p>
        </div>

        <div className="getting-started-step">
          <h3>{t.gettingStarted.step2Title}</h3>
          <p>{t.gettingStarted.step2Text}</p>
        </div>

        <div className="getting-started-step">
          <h3>{t.gettingStarted.step3Title}</h3>
          <p>{t.gettingStarted.step3Text}</p>
        </div>

        <p className="muted getting-started-outro">{t.gettingStarted.outro}</p>
      </div>
    </div>
  );
}
