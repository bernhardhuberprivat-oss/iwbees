import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CurrentUser } from "./userSession";
import { useT, useLang, LanguageSwitch } from "./i18n";
import {
  EULA_URL,
  PRIVACY_URL,
  openLegalLink,
  purchaseSubscription,
  restorePurchases,
  startWebCheckout,
} from "./subscription";

interface Props {
  user: CurrentUser;
  onUnlocked: () => void;
  onSwitchUser: () => void;
}

export default function Paywall({ user, onUnlocked, onSwitchUser }: Props) {
  const t = useT();
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isNative = Capacitor.isNativePlatform();

  async function handleSubscribe() {
    setBusy(true);
    setMessage("");
    // Native: RevenueCat/StoreKit-Kauf direkt in der App. Web: Weiterleitung zu
    // Stripes Checkout (siehe Anti-Steering-Hinweis in subscription.ts) - dort löst
    // sich die Seite komplett auf window.location.href = ..., "busy" bleibt also
    // einfach stehen, bis die Navigation greift.
    const result = isNative
      ? await purchaseSubscription(user, t.subscriptionMsg)
      : await startWebCheckout(user, t.subscriptionMsg);
    setBusy(false);
    if (result.success) {
      if (isNative) onUnlocked();
    } else if (result.message) {
      setMessage(result.message);
    }
  }

  async function handleRestore() {
    setBusy(true);
    setMessage("");
    const result = await restorePurchases(user, t.subscriptionMsg);
    setBusy(false);
    if (result.success) {
      onUnlocked();
    } else if (result.message) {
      setMessage(result.message);
    }
  }

  return (
    <div className="app">
      <LanguageSwitch />
      <header>
        <h1>{t.app.title}</h1>
        <p className="subtitle">{t.paywall.subtitle}</p>
      </header>
      <div className="paywall">
        <p>{t.paywall.intro(user.name)}</p>
        <ul className="paywall-benefits">
          <li>{t.paywall.benefit1}</li>
          <li>{t.paywall.benefit2}</li>
          <li>{t.paywall.benefit3}</li>
        </ul>
        <p className="paywall-price">{t.paywall.price}</p>
        <p className="paywall-terms">{t.paywall.terms}</p>
        <div className="paywall-legal">
          <button type="button" className="link" onClick={() => openLegalLink(EULA_URL)}>
            {t.app.eula}
          </button>
          <span className="paywall-legal-sep" aria-hidden="true">
            ·
          </span>
          <button type="button" className="link" onClick={() => openLegalLink(PRIVACY_URL(lang))}>
            {t.app.privacy}
          </button>
        </div>
        <button className="primary" onClick={handleSubscribe} disabled={busy}>
          {busy ? t.common.moment : isNative ? t.paywall.subscribeNative : t.paywall.subscribeWeb}
        </button>
        {isNative && (
          <button className="link" onClick={handleRestore} disabled={busy}>
            {t.paywall.restore}
          </button>
        )}
        {message && <p className="error">{message}</p>}
        <button className="link" onClick={onSwitchUser}>
          {t.paywall.switchAccount}
        </button>
      </div>
    </div>
  );
}
