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
  // Für Personen, die isybee auf einem neuen/anderen Gerät oder Browser öffnen und
  // bereits ein Konto haben (z. B. zweites Handy, neu installierter Browser, Handy
  // zurückgesetzt). Ohne diesen Button landeten sie zwangsläufig im Anlege-Formular,
  // weil onGetStarted UserPicker direkt im "create"-Modus startet - siehe App.tsx.
  onLogin: () => void;
}

export default function Welcome({ onGetStarted, onLogin }: Props) {
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

      <p className="welcome-login-hint">
        {t.welcome.existingAccountText}{" "}
        <button type="button" className="link-btn welcome-login-link" onClick={onLogin}>
          {t.welcome.existingAccountCta}
        </button>
      </p>

      <button type="button" className="link-btn welcome-install-link" onClick={() => setShowInstallGuide(true)}>
        {t.installGuide.trigger}
      </button>

      {showInstallGuide && <InstallGuide onClose={() => setShowInstallGuide(false)} />}
    </div>
  );
}
