import { useState, FormEvent } from "react";
import { CurrentUser } from "./userSession";
import { apiUrl } from "./apiBase";

interface Props {
  adminUser: CurrentUser;
  onClose: () => void;
}

interface AdminUserRow {
  id: number;
  name: string;
  hiveCount: number;
  createdAt: string;
  isGifted: boolean;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminPanel({ adminUser, onClose }: Props) {
  const [adminPin, setAdminPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function callAdmin(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch(apiUrl("/api/admin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminName: adminUser.name, adminPin, action, ...extra }),
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? "PIN falsch oder keine Admin-Berechtigung." : "Aktion fehlgeschlagen.");
    }
    return res.json();
  }

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await callAdmin("list");
      setUsers(data);
      setUnlocked(true);
    } catch (err: any) {
      setError(err.message || "Aktion fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleGift(target: AdminUserRow) {
    setBusyId(target.id);
    setError("");
    try {
      const updated = await callAdmin(target.isGifted ? "revoke" : "grant", { targetUserId: target.id });
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isGifted: updated.isGifted } : u)));
    } catch (err: any) {
      setError(err.message || "Aktion fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  async function expireTrial(target: AdminUserRow) {
    if (
      !window.confirm(
        `Testphase von "${target.name}" künstlich auf abgelaufen setzen (Beitrittsdatum wird um 40 Tage zurückgesetzt)? Nur für Demo-/Testkonten verwenden, z. B. für die Apple-App-Prüfung.`
      )
    ) {
      return;
    }
    setBusyId(target.id);
    setError("");
    try {
      const updated = await callAdmin("backdate", { targetUserId: target.id, days: 40 });
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, createdAt: updated.createdAt } : u)));
    } catch (err: any) {
      setError(err.message || "Aktion fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2>Admin: Nutzer verwalten</h2>
          <button type="button" className="link-btn" onClick={onClose}>
            Schließen
          </button>
        </div>

        {!unlocked && (
          <form className="user-form" onSubmit={handleUnlock}>
            <p className="muted">Bitte deinen PIN bestätigen, um die Nutzerliste zu sehen.</p>
            <label>
              4-stelliger PIN
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="user-form-actions">
              <button type="submit" disabled={loading || adminPin.length !== 4}>
                {loading ? "Prüfe…" : "Entsperren"}
              </button>
            </div>
          </form>
        )}

        {unlocked && (
          <>
            {error && <p className="error">{error}</p>}
            <table className="admin-user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Dabei seit</th>
                  <th>Stöcke</th>
                  <th>Abo</th>
                  <th>Test</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{u.hiveCount}</td>
                    <td>
                      <button
                        type="button"
                        className={u.isGifted ? "gift-toggle gifted" : "gift-toggle"}
                        onClick={() => toggleGift(u)}
                        disabled={busyId === u.id}
                      >
                        {busyId === u.id
                          ? "…"
                          : u.isGifted
                          ? "🎁 Geschenkt – entziehen"
                          : "Abo schenken"}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        title="Nur für Demo-/Testkonten: Beitrittsdatum um 40 Tage zurücksetzen, damit die Testphase sofort abgelaufen ist."
                        onClick={() => expireTrial(u)}
                        disabled={busyId === u.id}
                      >
                        {busyId === u.id ? "…" : "Trial ablaufen lassen"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
