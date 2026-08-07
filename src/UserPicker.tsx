import { useState, FormEvent } from "react";
import { CurrentUser, storeUser } from "./userSession";
import { apiUrl } from "./apiBase";

interface Props {
  onLogin: (user: CurrentUser) => void;
}

type Mode = "login" | "create";

export default function UserPicker({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setPin("");
    setPin2("");
    setError("");
    setInfo("");
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Bitte deinen Namen eingeben.");
      return;
    }
    setSubmitting(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch(apiUrl("/api/users-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, pin }),
      });
      if (!res.ok) {
        setError("Name oder PIN falsch");
        return;
      }
      const user = await res.json();
      storeUser(user);
      onLogin(user);
    } catch {
      setError("Keine Verbindung – Anmeldung braucht einmalig Internet.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Bitte zuerst deinen Namen eingeben.");
      return;
    }
    if (pin.length !== 4) {
      setError("Bitte zuerst den 4-stelligen PIN eingeben.");
      return;
    }
    if (
      !confirm(
        `Nutzer "${trimmedName}" wirklich löschen? Alle Stöcke, Einträge und Fotos dieses Nutzers werden dabei unwiderruflich gelöscht.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch(apiUrl("/api/users"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, pin }),
      });
      if (!res.ok) {
        setError("Name oder PIN falsch");
        return;
      }
      setName("");
      setPin("");
      setInfo("Nutzer wurde gelöscht.");
    } catch {
      setError("Keine Verbindung – zum Löschen brauchst du einmal Internet.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Bitte einen Namen eingeben.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("Der PIN muss aus genau 4 Ziffern bestehen.");
      return;
    }
    if (pin !== pin2) {
      setError("Die beiden PINs stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, pin }),
      });
      if (!res.ok) {
        setError(res.status === 409 ? "Dieser Name ist schon vergeben." : await res.text());
        return;
      }
      const user = await res.json();
      storeUser(user);
      onLogin(user);
    } catch {
      setError("Keine Verbindung – zum Anlegen eines neuen Nutzers brauchst du einmal Internet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="user-picker">
      <h2>Wer bist du?</h2>

      {mode === "login" && (
        <form className="user-form" onSubmit={handleLogin}>
          <label>
            Name
            <input
              type="text"
              autoFocus
              autoCapitalize="words"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Bernhard"
            />
          </label>
          <label>
            4-stelliger PIN
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
          <div className="user-form-actions">
            <button type="button" className="secondary" onClick={() => switchMode("create")}>
              Neuer Nutzer
            </button>
            <button type="submit" disabled={submitting || deleting || pin.length !== 4}>
              {submitting ? "Prüfe…" : "Anmelden"}
            </button>
          </div>
          <button
            type="button"
            className="link-btn delete-user-btn"
            onClick={handleDeleteUser}
            disabled={submitting || deleting}
          >
            {deleting ? "Lösche…" : "Diesen Nutzer löschen"}
          </button>
        </form>
      )}

      {mode === "create" && (
        <form className="user-form" onSubmit={handleCreate}>
          <label>
            Name
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Bernhard"
            />
          </label>
          <label>
            4-stelliger PIN
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
          <label>
            PIN wiederholen
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="user-form-actions">
            <button type="button" className="secondary" onClick={() => switchMode("login")}>
              Zurück
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Lege an…" : "Nutzer anlegen"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
