import { useState, FormEvent } from "react";
import { CurrentUser } from "./userSession";
import { apiUrl } from "./apiBase";
import { useT, useLang, dateLocale } from "./i18n";

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

export default function AdminPanel({ adminUser, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const [adminPin, setAdminPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  function formatDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t.common.none;
    return d.toLocaleDateString(dateLocale(lang), { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  async function callAdmin(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch(apiUrl("/api/admin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminName: adminUser.name, adminPin, action, ...extra }),
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? t.admin.errAuth : t.admin.errAction);
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
      setError(err.message || t.admin.errAction);
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
      setError(err.message || t.admin.errAction);
    } finally {
      setBusyId(null);
    }
  }

  async function expireTrial(target: AdminUserRow) {
    if (!window.confirm(t.admin.expireConfirm(target.name))) {
      return;
    }
    setBusyId(target.id);
    setError("");
    try {
      const updated = await callAdmin("backdate", { targetUserId: target.id, days: 40 });
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, createdAt: updated.createdAt } : u)));
    } catch (err: any) {
      setError(err.message || t.admin.errAction);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2>{t.admin.heading}</h2>
          <button type="button" className="link-btn" onClick={onClose}>
            {t.common.close}
          </button>
        </div>

        {!unlocked && (
          <form className="user-form" onSubmit={handleUnlock}>
            <p className="muted">{t.admin.unlockHint}</p>
            <label>
              {t.admin.pinLabel}
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
                {loading ? t.admin.checking : t.admin.unlock}
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
                  <th>{t.admin.colName}</th>
                  <th>{t.admin.colSince}</th>
                  <th>{t.admin.colHives}</th>
                  <th>{t.admin.colSubscription}</th>
                  <th>{t.admin.colTrial}</th>
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
                        {busyId === u.id ? "…" : u.isGifted ? t.admin.giftRevoke : t.admin.giftGrant}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        title={t.admin.expireTrialTitle}
                        onClick={() => expireTrial(u)}
                        disabled={busyId === u.id}
                      >
                        {busyId === u.id ? "…" : t.admin.expireTrialBtn}
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
