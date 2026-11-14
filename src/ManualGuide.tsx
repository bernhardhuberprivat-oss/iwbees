import { useEffect } from "react";
import { useT } from "./i18n";

// Benutzerhandbuch: erreichbar über das Kopfmenü (App.tsx). Zeigt kapitelweise, wie die App
// bedient wird. Texte stehen in i18n.tsx (manual.chapters), Deutsch und Englisch.
interface Props {
  onClose: () => void;
}

export default function ManualGuide({ onClose }: Props) {
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
      <div className="getting-started-panel manual-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>

        <h2 className="harvest-panel-heading">{t.manual.heading}</h2>
        <p className="muted getting-started-intro">{t.manual.intro}</p>

        {t.manual.chapters.map((c: { title: string; text: string }) => (
          <div className="getting-started-step" key={c.title}>
            <h3>{c.title}</h3>
            {c.text.split("\n").map((line: string, i: number) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
