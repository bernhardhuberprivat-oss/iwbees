import { useEffect, useState, FormEvent } from "react";
import { CurrentUser, storeUser } from "./userSession";

interface Props {
  onLogin: (user: CurrentUser) => void;
}

interface UserOption {
  id: number;
  name: string;
}

type Mode = "list" | "login" | "create";

export default function UserPicker({ onLogin }: Props) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<Mode>("list");
  const [selected, setSelected] = useState<UserOption | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch(() =>
        setLoadError(
          "Keine Verbindung zum Server. Zum ersten Anmelden brauchst du einmal Internet."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  function chooseUser(user: UserOption) {
    setSelected(user);
    setPin("");
    setError("");
    setMode("login");
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/users-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, pin }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Falscher PIN" : "Anmeldung fehlgeschlagen");
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
    if (!selected) return;
    if (pin.length !== 4) {
      setError("Bitte zuerst den 4-stelligen PIN eingeben.");
      return;
    }
    if (
      !confirm(
        `Nutzer "${selected.name}" wirklich löschen? Alle Stöcke, Einträge und Fotos dieses Nutzers werden dabei unwiderruflich gelöscht.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, pin }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Falscher PIN" : "Löschen fehlgeschlagen");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== selected.id));
      setSelected(null);
      setPin("");
      setMode("list");
    } catch {
      setError("Keine Verbindung – zum Löschen brauchst du einmal Internet.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");

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
      const res = await fetch("/api/users", {
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

      {mode === "list" && (
        <>
          {loading && <p className="muted">Lade Nutzer…</p>}
          {loadError && <p className="error">{loadError}</p>}
          {!loading && !loadError && users.length === 0 && (
            <p className="muted">Noch keine Nutzer angelegt.</p>
          )}
          <div className="user-list">
            {users.map((u) => (
              <button key={u.id} className="user-option" onClick={() => chooseUser(u)}>
                🐝 {u.name}
              </button>
            ))}
          </div>
          <button
            className="user-option new-user"
            onClick={() => {
              setMode("create");
              setName("");
              setPin("");
              setPin2("");
              setError("");
            }}
          >
            + Neuer Nutzer
          </button>
        </>
      )}

      {mode === "login" && selected && (
        <form className="user-form" onSubmit={handleLogin}>
          <p className="user-form-title">🐝 {selected.name}</p>
          <label>
            4-stelliger PIN
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="user-form-actions">
            <button type="button" className="secondary" onClick={() => setMode("list")}>
              Zurück
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
            <button type="button" className="secondary" onClick={() => setMode("list")}>
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
