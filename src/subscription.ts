// Abo-/Testphasen-Logik für die native iOS-App. Die Web-Version (iwbees.netlify.app)
// bleibt für die Familie komplett kostenlos - all das hier greift ausschließlich,
// wenn die App als native Capacitor-App läuft (Capacitor.isNativePlatform()).
import { Capacitor } from "@capacitor/core";
import { CurrentUser } from "./userSession";

const TRIAL_DAYS = 30;
const ENTITLEMENT_ID = "premium";

// Kommagetrennte Liste von Benutzer-IDs bzw. Anzeigenamen, die dauerhaft von der
// Bezahlschranke ausgenommen sind - für Bernhards eigenes Konto gedacht. Wird zur
// Build-Zeit über .env.native gesetzt: VITE_ADMIN_USER_IDS (z. B. "1" oder "1,4")
// und/oder VITE_ADMIN_USER_NAMES (z. B. "Entwickler"), Namen werden ohne Beachtung
// von Groß-/Kleinschreibung verglichen. Solange beide Variablen leer sind, hat
// niemand Admin-Rechte.
function getAdminUserIds(): number[] {
  const raw = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined) ?? "";
  return raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function getAdminUserNames(): string[] {
  const raw = (import.meta.env.VITE_ADMIN_USER_NAMES as string | undefined) ?? "";
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: CurrentUser): boolean {
  if (getAdminUserIds().includes(user.id)) return true;
  return getAdminUserNames().includes(user.name.trim().toLowerCase());
}

export function isTrialActive(user: CurrentUser): boolean {
  if (!user.createdAt) return true; // Sicherheitsnetz: ohne Datum lieber nicht aussperren
  const createdAt = new Date(user.createdAt).getTime();
  const ageMs = Date.now() - createdAt;
  return ageMs < TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

export function trialDaysLeft(user: CurrentUser): number {
  if (!user.createdAt) return TRIAL_DAYS;
  const createdAt = new Date(user.createdAt).getTime();
  const ageDays = (Date.now() - createdAt) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(TRIAL_DAYS - ageDays));
}

// Prüft per RevenueCat, ob ein aktives Abo (Entitlement "premium") vorliegt.
// Läuft absichtlich "fail open": Wenn kein API-Key gesetzt ist, RevenueCat nicht
// initialisiert werden kann oder die Abfrage fehlschlägt (z. B. offline), wird die
// App NICHT gesperrt - eine fehlerhafte Zahlungsprüfung soll nie zum Absturz oder
// zur ungerechtfertigten Aussperrung führen.
export async function checkSubscription(user: CurrentUser): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  if (isAdminUser(user)) return true;
  // Von einem Admin geschenktes Abo (siehe AdminPanel.tsx / netlify/functions/admin.mts) -
  // kommt direkt vom Server beim Login, braucht keinen RevenueCat-Aufruf.
  if (user.isGifted) return true;

  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY as string | undefined;
  if (!apiKey) return true;

  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey, appUserID: String(user.id) });
    const { customerInfo } = await Purchases.getCustomerInfo();
    return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
  } catch (err) {
    console.warn("RevenueCat-Prüfung fehlgeschlagen, Zugriff wird nicht gesperrt:", err);
    return true;
  }
}

// Startet den Kaufvorgang für das Monatsabo. Wird vom Paywall-Screen aufgerufen.
export async function purchaseSubscription(user: CurrentUser): Promise<{ success: boolean; message?: string }> {
  if (!Capacitor.isNativePlatform()) return { success: true };

  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY as string | undefined;
  if (!apiKey) {
    return { success: false, message: "Abo derzeit nicht verfügbar. Bitte später erneut versuchen." };
  }

  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey, appUserID: String(user.id) });
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) {
      return { success: false, message: "Kein Abo-Angebot gefunden. Bitte später erneut versuchen." };
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const active = Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
    return active
      ? { success: true }
      : { success: false, message: "Kauf abgeschlossen, aber Abo noch nicht aktiv. Bitte kurz warten." };
  } catch (err: any) {
    if (err?.userCancelled) return { success: false };
    console.warn("Kauf fehlgeschlagen:", err);
    return { success: false, message: "Kauf fehlgeschlagen. Bitte später erneut versuchen." };
  }
}

// Stellt frühere Käufe wieder her (z. B. nach App-Neuinstallation oder Gerätewechsel).
export async function restorePurchases(user: CurrentUser): Promise<{ success: boolean; message?: string }> {
  if (!Capacitor.isNativePlatform()) return { success: true };

  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY as string | undefined;
  if (!apiKey) {
    return { success: false, message: "Wiederherstellung derzeit nicht verfügbar." };
  }

  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey, appUserID: String(user.id) });
    const { customerInfo } = await Purchases.restorePurchases();
    const active = Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
    return active
      ? { success: true }
      : { success: false, message: "Keine aktiven Käufe für dieses Konto gefunden." };
  } catch (err) {
    console.warn("Wiederherstellung fehlgeschlagen:", err);
    return { success: false, message: "Wiederherstellung fehlgeschlagen. Bitte später erneut versuchen." };
  }
}
