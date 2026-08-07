import { useState } from "react";
import { CurrentUser } from "./userSession";
import { purchaseSubscription, restorePurchases } from "./subscription";

interface Props {
  user: CurrentUser;
  onUnlocked: () => void;
  onSwitchUser: () => void;
}

export default function Paywall({ user, onUnlocked, onSwitchUser }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubscribe() {
    setBusy(true);
    setMessage("");
    const result = await purchaseSubscription(user);
    setBusy(false);
    if (result.success) {
      onUnlocked();
    } else if (result.message) {
      setMessage(result.message);
    }
  }

  async function handleRestore() {
    setBusy(true);
    setMessage("");
    const result = await restorePurchases(user);
    setBusy(false);
    if (result.success) {
      onUnlocked();
    } else if (result.message) {
      setMessage(result.message);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>🐝 isybee</h1>
        <p className="subtitle">Deine kostenlose Testphase ist abgelaufen</p>
      </header>
      <div className="paywall">
        <p>
          Um isybee als <strong>{user.name}</strong> weiter zu nutzen, brauchst du das
          isybee-Monatsabo.
        </p>
        <ul className="paywall-benefits">
          <li>Unbegrenzt Tagebucheinträge und Fotos für alle deine Bienenstöcke</li>
          <li>Offline-Nutzung mit automatischer Synchronisierung</li>
          <li>Jahresauswertung und Erntestatistik</li>
        </ul>
        <p className="paywall-price">0,99&nbsp;€ / Monat, jederzeit kündbar</p>
        <button className="primary" onClick={handleSubscribe} disabled={busy}>
          {busy ? "Einen Moment …" : "Jetzt abonnieren"}
        </button>
        <button className="link" onClick={handleRestore} disabled={busy}>
          Käufe wiederherstellen
        </button>
        {message && <p className="error">{message}</p>}
        <button className="link" onClick={onSwitchUser}>
          Anderes Konto verwenden
        </button>
      </div>
    </div>
  );
}
