// Persistiert, ob das Sprachnotizen-Feature aktiviert ist - eine reine Geräte-/
// Browser-Einstellung (wie die Sprachwahl in i18n.tsx), kein Server-Wert. Bewusst
// per Default AUS: die Funktion ist neu und optional, das größere Mikrofon-Symbol im
// Tageseintrag soll nicht ungefragt bei allen Nutzer:innen auftauchen.
const STORAGE_KEY = "isybee:voiceNotesEnabled";

export function isVoiceNotesEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceNotesEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Speicher nicht verfügbar - Einstellung gilt dann nur für die aktuelle Sitzung
    // (React-State in App.tsx bleibt trotzdem aktiv, siehe dort).
  }
}
