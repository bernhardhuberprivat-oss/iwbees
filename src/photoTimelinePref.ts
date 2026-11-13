// Persistiert, ob der Foto-Zeitstrahl aktiviert ist - Geräte-/Browser-Einstellung wie
// bei voiceNotesPref.ts, bewusst per Default AUS (optionale Funktion, einschaltbar im Kopfmenü).
const STORAGE_KEY = "isybee:photoTimelineEnabled";

export function isPhotoTimelineEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPhotoTimelineEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Speicher nicht verfügbar - Einstellung gilt dann nur für die aktuelle Sitzung.
  }
}
