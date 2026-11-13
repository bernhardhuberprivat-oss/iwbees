import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useT } from "./i18n";

// Hinweis nur für Android-Handys, die isybee im Browser (Web-App) nutzen: die native App
// aus dem Play Store zeigt nach dem Login dieselben Daten. Einmal wegklickbar, merkt sich das.
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.iwbees.isybee";
const STORAGE_KEY = "isybee:androidHintDismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AndroidAppHint() {
  const t = useT();
  const [hidden, setHidden] = useState(() => wasDismissed());

  const isAndroidWeb = !Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent);
  if (!isAndroidWeb || hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Speicher nicht verfügbar - Hinweis ist dann nur bis zum Neuladen weg.
    }
  }

  return (
    <div className="android-hint" role="note">
      <p>{t.androidHint.text}</p>
      <div className="android-hint-actions">
        <a className="android-hint-btn" href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
          {t.androidHint.button}
        </a>
        <button type="button" className="android-hint-close" onClick={dismiss}>
          {t.androidHint.dismiss}
        </button>
      </div>
    </div>
  );
}
