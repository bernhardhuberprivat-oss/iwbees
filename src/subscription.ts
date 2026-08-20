// Abo-/Testphasen-Logik für isybee. Native iOS-App: RevenueCat/StoreKit. Web-Build
// (iwbees.netlify.app, PWA/Android): Stripe-Checkout, siehe startWebCheckout() unten.
// Beide Plattformen teilen sich dieselbe 30-Tage-Testphase-Regel und denselben
// Admin-/Geschenkt-Bypass, aber jeweils einen eigenen Zeit-Anker (createdAt für nativ,
// webTrialStart für Web) und eine eigene Zahlungsquelle - siehe die "ONE
// project/repo/backend/DB"-Architekturentscheidung im hopfrain/isybee-Skill: beide
// Wege dürfen sich nie gegenseitig beeinflussen können.
import { Capacitor } from "@capacitor/core";
import { CurrentUser } from "./userSession";
import { apiUrl } from "./apiBase";
import { Lang } from "./i18n";

// Typ der übersetzten Meldungen (siehe i18n.tsx -> subscriptionMsg) - wird von den
// Funktionen unten als Parameter erwartet, weil dieses Modul außerhalb von React-
// Komponenten liegt und daher useT() nicht selbst aufrufen kann.
type SubscriptionMsg = {
  notAvailable: string;
  noOffer: string;
  purchasedNotActiveYet: string;
  purchaseFailed: string;
  restoreNotAvailable: string;
  noActivePurchases: string;
  restoreFailed: string;
  billingPortalNotAvailable: string;
};

const TRIAL_DAYS = 30;
const ENTITLEMENT_ID = "premium";

// Von Apple für Auto-renewable-Subscriptions verlangte Links (Guideline 3.1.2), die
// direkt im Kaufbildschirm (Paywall.tsx) angezeigt werden müssen - nicht nur in den
// App-Store-Metadaten. EULA ist Apples Standard-EULA (kein eigener Text nötig, wird von
// Apple selbst je nach Systemsprache dargestellt).
export const EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

// Zwei separate statische Seiten (public/datenschutz.html bzw. public/privacy.html),
// passend zur aktuell gewählten App-Oberflächensprache - siehe i18n.tsx.
export function PRIVACY_URL(lang: Lang): string {
  return lang === "de" ? "https://iwbees.netlify.app/datenschutz.html" : "https://iwbees.netlify.app/privacy.html";
}

// Öffnet einen externen Link (EULA/Datenschutz) verlässlich im System-Browser statt in
// der eingebetteten WKWebView der App - nativ über das Capacitor-Browser-Plugin, im
// Web-Build per normalem window.open. So bleibt der Link "funktional" im Sinne von
// Apples Review auch dann, wenn die App keine eigene In-App-Navigation dafür hat.
export async function openLegalLink(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch (err) {
      console.warn("Browser-Plugin fehlgeschlagen, Fallback auf window.open:", err);
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

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

// Native App: createdAt (Kontoerstellung). Web: webTrialStart (siehe userSession.ts) -
// für Bestandskonten von vor der Web-Abo-Einführung ist das NICHT dasselbe Datum wie
// createdAt, sondern der Zeitpunkt ihres ersten Logins nach dem Rollout (wird
// server-seitig in netlify/functions/users-login.mts nachgetragen).
function trialAnchor(user: CurrentUser): string | undefined {
  return Capacitor.isNativePlatform() ? user.createdAt : user.webTrialStart;
}

export function isTrialActive(user: CurrentUser): boolean {
  const anchor = trialAnchor(user);
  if (!anchor) return true; // Sicherheitsnetz: ohne Datum lieber nicht aussperren
  const anchorMs = new Date(anchor).getTime();
  const ageMs = Date.now() - anchorMs;
  return ageMs < TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

export function trialDaysLeft(user: CurrentUser): number {
  const anchor = trialAnchor(user);
  if (!anchor) return TRIAL_DAYS;
  const anchorMs = new Date(anchor).getTime();
  const ageDays = (Date.now() - anchorMs) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(TRIAL_DAYS - ageDays));
}

// Prüft per RevenueCat, ob ein aktives Abo (Entitlement "premium") vorliegt.
// Läuft absichtlich "fail open": Wenn kein API-Key gesetzt ist, RevenueCat nicht
// initialisiert werden kann oder die Abfrage fehlschlägt (z. B. offline), wird die
// App NICHT gesperrt - eine fehlerhafte Zahlungsprüfung soll nie zum Absturz oder
// zur ungerechtfertigten Aussperrung führen.
export async function checkSubscription(user: CurrentUser): Promise<boolean> {
  if (isAdminUser(user)) return true;
  // Von einem Admin geschenktes Abo (siehe AdminPanel.tsx / netlify/functions/admin.mts) -
  // kommt direkt vom Server beim Login, braucht keinen RevenueCat-/Stripe-Aufruf.
  if (user.isGifted) return true;

  if (!Capacitor.isNativePlatform()) {
    // Web-Build: kein RevenueCat, der Server hat webSubscriptionActive schon beim
    // Login berechnet (netlify/functions/users-login.mts, isStripeStatusActive()).
    // Direkt nach einer Stripe-Checkout-Rückkehr kann das kurz hinter dem tatsächlichen
    // Stand liegen, bis der Webhook durchgelaufen ist - siehe refreshWebSubscriptionStatus()
    // in App.tsx, das genau diesen Fall abfängt.
    return Boolean(user.webSubscriptionActive);
  }

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
export async function purchaseSubscription(
  user: CurrentUser,
  msg: SubscriptionMsg
): Promise<{ success: boolean; message?: string }> {
  if (!Capacitor.isNativePlatform()) return { success: true };

  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY as string | undefined;
  if (!apiKey) {
    return { success: false, message: msg.notAvailable };
  }

  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey, appUserID: String(user.id) });
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) {
      return { success: false, message: msg.noOffer };
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const active = Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
    return active ? { success: true } : { success: false, message: msg.purchasedNotActiveYet };
  } catch (err: any) {
    if (err?.userCancelled) return { success: false };
    console.warn("Kauf fehlgeschlagen:", err);
    return { success: false, message: msg.purchaseFailed };
  }
}

// Stellt frühere Käufe wieder her (z. B. nach App-Neuinstallation oder Gerätewechsel).
export async function restorePurchases(
  user: CurrentUser,
  msg: SubscriptionMsg
): Promise<{ success: boolean; message?: string }> {
  if (!Capacitor.isNativePlatform()) return { success: true };

  const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY as string | undefined;
  if (!apiKey) {
    return { success: false, message: msg.restoreNotAvailable };
  }

  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey, appUserID: String(user.id) });
    const { customerInfo } = await Purchases.restorePurchases();
    const active = Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
    return active ? { success: true } : { success: false, message: msg.noActivePurchases };
  } catch (err) {
    console.warn("Wiederherstellung fehlgeschlagen:", err);
    return { success: false, message: msg.restoreFailed };
  }
}

// --- Web-Abo (Stripe) -------------------------------------------------------------
// Nur für den Web-Build gedacht (Paywall.tsx blendet diesen Weg auf
// Capacitor.isNativePlatform() aus) - siehe Apples Anti-Steering-Regel, Guideline
// 3.1.1: die native App darf niemals auf einen externen Zahlungsweg verweisen.

// Startet den Stripe-Checkout: fragt eine Checkout-URL vom Server ab und leitet den
// Browser dorthin weiter (volle Seitennavigation, kein Popup - robuster gegen
// Popup-Blocker und funktioniert identisch auf Mobile/Desktop).
export async function startWebCheckout(
  user: CurrentUser,
  msg: SubscriptionMsg
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(apiUrl("/api/stripe-checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (!res.ok) {
      return { success: false, message: msg.notAvailable };
    }
    const { url } = await res.json();
    if (!url) {
      return { success: false, message: msg.notAvailable };
    }
    window.location.href = url;
    return { success: true };
  } catch (err) {
    console.warn("Stripe-Checkout konnte nicht gestartet werden:", err);
    return { success: false, message: msg.notAvailable };
  }
}

// Öffnet Stripes Customer Portal, damit Web-Abonnent:innen ihr Abo selbst verwalten
// oder kündigen können (nur sinnvoll, wenn schon einmal abonniert wurde).
export async function openWebBillingPortal(
  user: CurrentUser,
  msg: SubscriptionMsg
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(apiUrl("/api/stripe-portal"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (!res.ok) {
      return { success: false, message: msg.billingPortalNotAvailable };
    }
    const { url } = await res.json();
    if (!url) {
      return { success: false, message: msg.billingPortalNotAvailable };
    }
    window.location.href = url;
    return { success: true };
  } catch (err) {
    console.warn("Stripe-Portal konnte nicht geöffnet werden:", err);
    return { success: false, message: msg.billingPortalNotAvailable };
  }
}

// Fragt den aktuellen Trial-/Abo-Status frisch vom Server ab (netlify/functions/
// subscription-status.mts) - ohne erneute PIN-Eingabe. Wird von App.tsx u. a. direkt
// nach der Rückkehr von Stripes Checkout aufgerufen, weil der Webhook, der
// webSubscriptionActive tatsächlich umschaltet, asynchron und mit ein paar Sekunden
// Verzögerung nach dem Checkout-Redirect eintrifft.
export async function refreshWebSubscriptionStatus(user: CurrentUser): Promise<CurrentUser> {
  try {
    const res = await fetch(apiUrl(`/api/subscription-status?userId=${user.id}`));
    if (!res.ok) return user;
    const data = await res.json();
    return {
      ...user,
      webTrialStart: data.webTrialStart ?? user.webTrialStart,
      webSubscriptionActive: Boolean(data.webSubscriptionActive),
      isGifted: typeof data.isGifted === "boolean" ? data.isGifted : user.isGifted,
    };
  } catch (err) {
    console.warn("Abo-Status konnte nicht aktualisiert werden:", err);
    return user;
  }
}
