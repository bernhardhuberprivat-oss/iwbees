// Merkt sich den aktuell angemeldeten Nutzer auf diesem Gerät, damit man nicht bei
// jedem Öffnen der App den PIN erneut eingeben muss.

export interface CurrentUser {
  id: number;
  name: string;
}

const KEY = "bienentagebuch:currentUser";

export function getStoredUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: CurrentUser) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // Speicher nicht verfügbar - Nutzer muss sich beim nächsten Mal erneut anmelden
  }
}

export function clearStoredUser() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignorieren
  }
}
