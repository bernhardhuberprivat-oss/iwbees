import { useState, FormEvent } from "react";
import { CurrentUser, storeUser } from "./userSession";
import { apiUrl } from "./apiBase";
import { useT } from "./i18n";

interface Props {
  onLogin: (user: CurrentUser) => void;
  // Optional: startet direkt im Anlege-Formular statt im Login - genutzt, wenn jemand
  // gerade vom Willkommens-Bildschirm (Welcome.tsx) kommt und "Los geht's" getippt hat,
  // dort ergibt ein Login-Formular für ein noch nicht existierendes Konto keinen Sinn.
  initialMode?: Mode;
}

type Mode = "login" | "create";

export default function UserPicker({ onLogin, initialMode }: Props) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(initialMode ?? "login");
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
      setError(t.userPicker.errNameRequired);
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
        setError(t.userPicker.errLoginFailed);
        return;
      }
      const user = await res.json();
      storeUser(user);
      onLogin(user);
    } catch {
      setError(t.userPicker.errNoConnectionLogin);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t.userPicker.errNameRequiredDelete);
      return;
    }
    if (pin.length !== 4) {
      setError(t.userPicker.errPinRequiredDelete);
      return;
    }
    if (!confirm(t.userPicker.confirmDelete(trimmedName))) {
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
        setError(t.userPicker.errLoginFailed);
        return;
      }
      setName("");
      setPin("");
      setInfo(t.userPicker.infoDeleted);
    } catch {
      setError(t.userPicker.errNoConnectionDelete);
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
      setError(t.userPicker.errNameRequiredCreate);
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError(t.userPicker.errPinFormat);
      return;
    }
    if (pin !== pin2) {
      setError(t.userPicker.errPinMismatch);
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
        setError(res.status === 409 ? t.userPicker.errNameTaken : await res.text());
        return;
      }
      const user = await res.json();
      storeUser(user);
      onLogin(user);
    } catch {
      setError(t.userPicker.errNoConnectionCreate);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="user-picker">
      <h2>{t.userPicker.heading}</h2>

      {mode === "login" && (
        <form className="user-form" onSubmit={handleLogin}>
          <label>
            {t.userPicker.nameLabel}
            <input
              type="text"
              autoFocus
              autoCapitalize="words"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.userPicker.namePlaceholder}
            />
          </label>
          <label>
            {t.userPicker.pinLabel}
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
              {t.userPicker.newUser}
            </button>
            <button type="submit" disabled={submitting || deleting || pin.length !== 4}>
              {submitting ? t.userPicker.checking : t.userPicker.login}
            </button>
          </div>
          <button
            type="button"
            className="link-btn delete-user-btn"
            onClick={handleDeleteUser}
            disabled={submitting || deleting}
          >
            {deleting ? t.userPicker.deleting : t.userPicker.deleteUser}
          </button>
        </form>
      )}

      {mode === "create" && (
        <form className="user-form" onSubmit={handleCreate}>
          <label>
            {t.userPicker.nameLabel}
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.userPicker.namePlaceholder}
            />
          </label>
          <label>
            {t.userPicker.pinLabel}
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
          <label>
            {t.userPicker.pinRepeatLabel}
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
              {t.userPicker.back}
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? t.userPicker.creating : t.userPicker.create}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
