// Merkt sich den aktuell angemeldeten Nutzer auf diesem Gerät, damit man nicht bei
// jedem Öffnen der App den PIN erneut eingeben muss.

export interface CurrentUser {
  id: number;
  name: string;
  hiveCount?: number;
  // ISO-Zeitstempel der Kontoerstellung, wird für die 30-Tage-Testphase in der
  // nativen iOS-App gebraucht (src/subscription.ts).
  createdAt?: string;
  // true, wenn ein Admin diesem Konto das Abo geschenkt hat (siehe subscription.ts).
  isGifted?: boolean;
  // ISO-Zeitstempel, ab dem die 30-Tage-Testphase im WEB-Build zählt - eigener Anker,
  // getrennt von createdAt, damit bestehende Web-Konten erst ab der Einführung des
  // Web-Abos (nicht ab ihrer ursprünglichen Kontoerstellung) angerechnet bekommen.
  webTrialStart?: string;
  // true, wenn für dieses Konto ein aktives Stripe-Abo (oder ein geschenktes Abo)
  // vorliegt - wird vom Server berechnet (netlify/functions/_subscriptionSchema.mts).
  webSubscriptionActive?: boolean;
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
