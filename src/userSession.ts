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

// Merkt sich pro Gerät, ob der Willkommens-/Onboarding-Bildschirm (Welcome.tsx) schon
// gezeigt wurde - der soll nur beim allerersten Öffnen der App erscheinen, bevor
// überhaupt ein Konto existiert. Bewusst ein eigener, simpler Flag statt an den
// Nutzer-Login gekoppelt, damit er auch dann nicht erneut aufploppt, wenn jemand sich
// abmeldet/den Nutzer wechselt (siehe onSwitchUser in App.tsx).
const WELCOME_SEEN_KEY = "isybee:welcomeSeen";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    // localStorage nicht verfügbar - im Zweifel lieber den Willkommens-Bildschirm
    // überspringen, als jemanden bei jedem Start erneut damit zu blockieren.
    return true;
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    // ignorieren
  }
}
