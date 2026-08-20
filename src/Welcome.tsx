import { useState } from "react";
import { useT } from "./i18n";
import InstallGuide from "./InstallGuide";

// Willkommens-/Onboarding-Bildschirm, der einer Person nur beim allerersten Öffnen
// der App angezeigt wird (bevor es überhaupt ein Konto gibt) - siehe hasSeenWelcome()/
// markWelcomeSeen() in userSession.ts. Zweck: seit isybee auch per WhatsApp/QR-Code an
// wildfremde Personen beworben wird (nicht mehr nur Familie/Bekannte, die schon wissen
// worum es geht), soll der erste Eindruck erklären was die App macht, statt direkt mit
// einem nackten Login-Formular zu starten.
interface Props {
  onGetStarted: () => void;
}

export default function Welcome({ onGetStarted }: Props) {
  const t = useT();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  return (
    <div className="app welcome-screen">
      <img src="/icon-512.png" alt="isybee" className="welcome-icon" />
      <h1 className="welcome-wordmark">isybee</h1>
      <p className="welcome-claim">{t.welcome.claim}</p>

      <ul className="welcome-bullets">
        <li>{t.welcome.bullet1}</li>
        <li>{t.welcome.bullet2}</li>
        <li>{t.welcome.bullet3}</li>
      </ul>

      <p className="welcome-trial">{t.welcome.trialInfo}</p>

      <button type="button" className="welcome-cta" onClick={onGetStarted}>
        {t.welcome.cta}
      </button>

      <button type="button" className="link-btn welcome-install-link" onClick={() => setShowInstallGuide(true)}>
        {t.installGuide.trigger}
      </button>

      {showInstallGuide && <InstallGuide onClose={() => setShowInstallGuide(false)} />}
    </div>
  );
}
