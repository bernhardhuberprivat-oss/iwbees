import { useCallback, useEffect, useState, FormEvent } from "react";
import { Entry, HiveInfo, buildHiveRange, getQueenColorForYear } from "./types";
import NewEntryForm from "./NewEntryForm";
import EntryList from "./EntryList";
import ColorPicker from "./ColorPicker";
import HarvestPanel, { HarvestEntry } from "./HarvestPanel";
import HarvestSummary from "./HarvestSummary";
import UserPicker from "./UserPicker";
import Welcome from "./Welcome";
import InstallGuide from "./InstallGuide";
import Paywall from "./Paywall";
import AdminPanel from "./AdminPanel";
import { Capacitor } from "@capacitor/core";
import {
  CurrentUser,
  getStoredUser,
  clearStoredUser,
  storeUser,
  hasSeenWelcome,
  markWelcomeSeen,
} from "./userSession";
import { cacheGet, cacheSet, getPendingEntries, deletePendingEntry, pendingToDisplayEntry, syncPendingEntries } from "./offline";
import { readableTextColor, hiveRingColor } from "./colorUtils";
import { apiUrl } from "./apiBase";
import { useT, useLang, LanguageSwitch } from "./i18n";
import {
  isTrialActive,
  checkSubscription,
  isAdminUser,
  EULA_URL,
  PRIVACY_URL,
  openLegalLink,
  refreshWebSubscriptionStatus,
  openWebBillingPortal,
} from "./subscription";

function formatDateDE(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

// Präfix, an dem automatisch erzeugte Stammdaten-Änderungsprotokolle erkannt werden,
// damit sie in einem eigenen Reiter statt bei den normalen Tageseinträgen erscheinen.
//
// WICHTIG: bleibt bewusst IMMER auf Deutsch (samt formatDateDE im DD.MM.YYYY-Format),
// unabhängig von der aktuell gewählten Anzeigesprache - dieser Präfix ist ein reiner
// interner Erkennungs-Marker (notes?.startsWith(...)) und darf sich nie ändern, sonst
// würden alte, in Deutsch angelegte Protokolleinträge nicht mehr erkannt, sobald jemand
// auf Englisch umschaltet. Nur die einzelnen Änderungszeilen darunter (describeStockPatch)
// werden in der jeweils aktuellen Anzeigesprache formuliert.
const STOCK_CHANGE_PREFIX = "Änderung an allgemeinen Daten vom Stock am";

// Übersetzt eine Änderung an den Stock-Stammdaten in lesbare Zeilen für den Tagebucheintrag,
// in der aktuell eingestellten Anzeigesprache (siehe Hinweis zu STOCK_CHANGE_PREFIX oben).
function describeStockPatch(patch: Record<string, unknown>, t: ReturnType<typeof useT>): string[] {
  const lines: string[] = [];
  if ("name" in patch) lines.push(t.app.stockChangeName(String(patch.name || "")));
  if ("color" in patch) lines.push(t.app.stockChangeColor);
  if ("category" in patch) lines.push(t.app.stockChangeCategory(String(patch.category || "")));
  if ("queenYear" in patch) {
    const year = patch.queenYear as number | null;
    const color = year ? getQueenColorForYear(year) : null;
    const colorName = color ? t.colorNames[color.name] ?? color.name : null;
    lines.push(t.app.stockChangeQueenYear(year ? `${year}${colorName ? ` (${colorName})` : ""}` : "–"));
  }
  if ("colonyStrength" in patch) {
    const raw = String(patch.colonyStrength || "");
    lines.push(t.app.stockChangeStrength(raw ? t.strengthLabels[raw] ?? raw : ""));
  }
  return lines;
}

type AccessState = "checking" | "granted" | "locked";

export default function App() {
  const t = useT();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => getStoredUser());
  const [access, setAccess] = useState<AccessState>("checking");
  // Willkommens-Bildschirm nur beim allerersten Öffnen der App (siehe Welcome.tsx/
  // hasSeenWelcome()) - bleibt für den Rest der Session false, auch wenn später über
  // "Nutzer wechseln" erneut die Login-Ansicht erscheint.
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());
  // Wird true, wenn "Los geht's" auf dem Willkommens-Bildschirm getippt wurde, damit
  // UserPicker direkt im Anlege-Formular statt im Login startet. Setzt sich nach dem
  // ersten erfolgreichen Login/Anlegen automatisch wieder zurück (siehe onLogin unten),
  // damit ein späteres "Nutzer wechseln" wieder ganz normal im Login-Modus landet.
  const [pendingCreateMode, setPendingCreateMode] = useState(false);

  function handleSwitchUser() {
    clearStoredUser();
    setCurrentUser(null);
    setAccess("checking");
  }

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function evaluateAccess() {
      let user = currentUser!;

      // Web-Build: Abo-Status frisch vom Server holen, bevor wir isTrialActive()/
      // checkSubscription() auswerten - die aus dem localStorage gecachten Werte
      // (userSession.ts) könnten veraltet sein, z. B. direkt nach einer Rückkehr von
      // Stripes Checkout, wo der Webhook noch nicht durchgelaufen ist. Kommt man mit
      // ?stripe=success zurück, kurz ein paar Mal nachfragen, statt den Nutzer sofort
      // wieder an der Paywall abzuweisen.
      if (!Capacitor.isNativePlatform()) {
        const cameFromCheckout = new URLSearchParams(window.location.search).get("stripe") === "success";
        const attempts = cameFromCheckout ? 5 : 1;
        for (let i = 0; i < attempts; i++) {
          user = await refreshWebSubscriptionStatus(user);
          if (!cancelled) {
            setCurrentUser(user);
            storeUser(user);
          }
          if (!cameFromCheckout || user.webSubscriptionActive) break;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (cameFromCheckout) {
          const url = new URL(window.location.href);
          url.searchParams.delete("stripe");
          window.history.replaceState({}, "", url.toString());
        }
      }

      // isTrialActive() prüft nur die 30-Tage-Testphase; Admin-Konten werden erst im
      // checkSubscription()-Fallback unten geprüft (siehe isAdminUser() in subscription.ts).
      if (isTrialActive(user)) {
        if (!cancelled) setAccess("granted");
        return;
      }
      const subscribed = await checkSubscription(user);
      if (!cancelled) setAccess(subscribed ? "granted" : "locked");
    }

    evaluateAccess();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    if (showWelcome) {
      return (
        <Welcome
          onGetStarted={() => {
            markWelcomeSeen();
            setShowWelcome(false);
            setPendingCreateMode(true);
          }}
          onLogin={() => {
            markWelcomeSeen();
            setShowWelcome(false);
            setPendingCreateMode(false);
          }}
        />
      );
    }
    return (
      <div className="app">
        <LanguageSwitch />
        <header>
          <h1>{t.app.title}</h1>
          <p className="subtitle">{t.app.subtitleLogin}</p>
        </header>
        <UserPicker
          onLogin={(user) => {
            setPendingCreateMode(false);
            setCurrentUser(user);
          }}
          initialMode={pendingCreateMode ? "create" : "login"}
        />
      </div>
    );
  }

  if (access === "checking") {
    return (
      <div className="app">
        <LanguageSwitch />
        <header>
          <h1>{t.app.title}</h1>
        </header>
        <p className="subtitle">{t.common.moment}</p>
      </div>
    );
  }

  if (access === "locked") {
    return (
      <Paywall
        user={currentUser}
        onUnlocked={() => setAccess("granted")}
        onSwitchUser={handleSwitchUser}
      />
    );
  }

  return <Diary user={currentUser} onSwitchUser={handleSwitchUser} />;
}

interface DiaryProps {
  user: CurrentUser;
  onSwitchUser: () => void;
}

function Diary({ user, onSwitchUser }: DiaryProps) {
  const t = useT();
  const { lang } = useLang();
  const [selectedHive, setSelectedHive] = useState<number | "all">("all");
  const [harvestEntries, setHarvestEntries] = useState<HarvestEntry[]>([]);
  const [harvestYearTotal, setHarvestYearTotal] = useState(0);
  const [showHarvestPanel, setShowHarvestPanel] = useState(false);
  const [showHarvestSummary, setShowHarvestSummary] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiveInfo, setHiveInfo] = useState<Record<number, HiveInfo>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [hiveCount, setHiveCount] = useState(user.hiveCount || 10);
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [showHiveCountEditor, setShowHiveCountEditor] = useState(false);
  const [hiveCountInput, setHiveCountInput] = useState(String(user.hiveCount || 10));
  const [hiveCountError, setHiveCountError] = useState("");
  const [savingHiveCount, setSavingHiveCount] = useState(false);
  const [totalUserCount, setTotalUserCount] = useState<number | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [openingBillingPortal, setOpeningBillingPortal] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  async function handleManageWebSubscription() {
    setOpeningBillingPortal(true);
    const result = await openWebBillingPortal(user, t.subscriptionMsg);
    // Bei Erfolg navigiert der Browser sofort zu Stripe weg - setOpeningBillingPortal(false)
    // wird dann praktisch nie mehr sichtbar. Bei einem Fehler (z. B. kein Kunde bei
    // Stripe gefunden) bleibt die Seite hier und braucht den zurückgesetzten Zustand.
    setOpeningBillingPortal(false);
    if (!result.success && result.message) {
      window.alert(result.message);
    }
  }

  useEffect(() => {
    if (!isAdminUser(user)) return;
    let cancelled = false;
    fetch(apiUrl("/api/users"))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTotalUserCount(data.count ?? null);
      })
      .catch(() => {
        // still keine große Sache - die Anzahl ist nur eine grobe Zusatzinfo für den Admin
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSaveHiveCount(e: FormEvent) {
    e.preventDefault();
    const next = Number(hiveCountInput);
    if (!Number.isInteger(next) || next < 1 || next > 60) {
      setHiveCountError(t.app.hiveCountError);
      return;
    }
    setSavingHiveCount(true);
    setHiveCountError("");
    try {
      const res = await fetch(apiUrl("/api/users"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, hiveCount: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      setHiveCount(next);
      storeUser({ ...user, hiveCount: next });
      if (typeof selectedHive === "number" && selectedHive > next) {
        setSelectedHive("all");
      }
      setShowHiveCountEditor(false);
    } catch {
      setHiveCountError(t.app.hiveCountSaveError);
    } finally {
      setSavingHiveCount(false);
    }
  }

  useEffect(() => {
    setShowNewEntryForm(false);
  }, [selectedHive]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const cacheKey = `entries:${user.id}:${selectedHive}`;
    try {
      const query = selectedHive === "all" ? "" : `&hive=${selectedHive}`;
      const res = await fetch(apiUrl(`/api/entries?userId=${user.id}${query}`));
      const data: Entry[] = await res.json();
      cacheSet(cacheKey, data);
      await mergeWithPending(data);
    } catch {
      // offline - letzten bekannten Stand aus dem Cache nehmen
      const cached = cacheGet<Entry[]>(cacheKey) || [];
      await mergeWithPending(cached);
    } finally {
      setLoading(false);
    }
  }, [selectedHive, user.id]);

  async function mergeWithPending(baseEntries: Entry[]) {
    const pending = await getPendingEntries(user.id);
    const relevant = pending.filter((p) => selectedHive === "all" || p.hive === selectedHive);
    const pendingDisplay = relevant.map(pendingToDisplayEntry);
    const combined = [...pendingDisplay, ...baseEntries].sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : 0
    );
    setEntries(combined);
    setPendingCount(pending.length);
  }

  const loadHiveInfo = useCallback(async () => {
    const cacheKey = `hiveInfo:${user.id}`;
    try {
      const res = await fetch(apiUrl(`/api/hive-colors?userId=${user.id}`));
      const data = await res.json();
      cacheSet(cacheKey, data);
      setHiveInfo(data);
    } catch {
      setHiveInfo(cacheGet<Record<number, HiveInfo>>(cacheKey) || {});
    }
  }, [user.id]);

  const trySync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncPendingEntries();
    } finally {
      setSyncing(false);
      loadEntries();
    }
  }, [loadEntries]);

  const loadHarvest = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/harvest-entries?userId=${user.id}&year=${new Date().getFullYear()}`));
      const data = await res.json();
      setHarvestEntries(data.entries || []);
      setHarvestYearTotal(Number(data.yearTotal) || 0);
    } catch {
      // offline - Badge zeigt einfach den zuletzt bekannten Stand
    }
  }, [user.id]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    loadHiveInfo();
  }, [loadHiveInfo]);

  useEffect(() => {
    loadHarvest();
  }, [loadHarvest]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      trySync();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (navigator.onLine) trySync();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: number) {
    if (!confirm(t.app.confirmDeleteEntry)) return;
    if (id < 0) {
      await deletePendingEntry(-id);
      loadEntries();
      return;
    }
    await fetch(apiUrl(`/api/entries?id=${id}&userId=${user.id}`), { method: "DELETE" });
    loadEntries();
  }

  async function handleUpdateHive(
    hive: number,
    patch: {
      color?: string | null;
      name?: string | null;
      category?: string | null;
      queenYear?: number | null;
      colonyStrength?: string | null;
    }
  ) {
    setHiveInfo((prev) => {
      const next = { ...prev, [hive]: { ...prev[hive], ...patch } };
      cacheSet(`hiveInfo:${user.id}`, next);
      return next;
    });
    try {
      await fetch(apiUrl("/api/hive-colors"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, hive, ...patch }),
      });
    } catch {
      // offline - Änderung bleibt lokal, wird beim nächsten Online-Besuch erneut gesendet
    }

    await logStockChange(hive, patch, { ...hiveInfo[hive], ...patch });
  }

  // Trägt automatisch einen Tagebucheintrag ein, wenn sich etwas im permanenten
  // Stock-Stammdaten-Fenster ändert - höchstens einen pro Stock und Tag, damit die Liste
  // nicht mit vielen gleichlautenden Einträgen zuspammt. Änderungen am selben Tag werden
  // an den bereits bestehenden Log-Eintrag angehängt, damit man sieht, was sich geändert hat.
  async function logStockChange(hive: number, patch: Record<string, unknown>, info: HiveInfo) {
    const changeLines = describeStockPatch(patch, t);
    if (changeLines.length === 0) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const titleLine = `${STOCK_CHANGE_PREFIX} ${formatDateDE(todayStr)}`;
    const queenColor = info.queenYear ? getQueenColorForYear(info.queenYear)?.hex ?? null : null;

    const existing = entries.find(
      (e) => e.hive === hive && e.entry_date === todayStr && e.notes?.startsWith(titleLine) && e.id > 0
    );

    try {
      if (existing) {
        const updatedNotes = `${existing.notes}\n${changeLines.join("\n")}`;
        const form = new FormData();
        form.set("id", String(existing.id));
        form.set("userId", String(user.id));
        form.set("entryDate", todayStr);
        form.set("notes", updatedNotes);
        form.set("queenColor", queenColor || "");
        form.set("queenYear", info.queenYear ? String(info.queenYear) : "");
        form.set("colonyStrength", info.colonyStrength || "");
        form.set("varroa", existing.varroa || "");
        form.set("feeding", existing.feeding || "");
        form.set("weightKg", existing.weight_kg != null ? String(existing.weight_kg) : "");
        form.set("keepPhotoKeys", JSON.stringify(existing.photo_keys || []));
        await fetch(apiUrl("/api/entries"), { method: "PUT", body: form });
      } else {
        const notes = `${titleLine}\n${changeLines.join("\n")}`;
        const form = new FormData();
        form.set("userId", String(user.id));
        form.set("hive", String(hive));
        form.set("entryDate", todayStr);
        form.set("notes", notes);
        form.set("queenColor", queenColor || "");
        form.set("queenYear", info.queenYear ? String(info.queenYear) : "");
        form.set("colonyStrength", info.colonyStrength || "");
        form.set("varroa", "");
        form.set("feeding", "");
        await fetch(apiUrl("/api/entries"), { method: "POST", body: form });
      }
      if (selectedHive === hive) {
        loadEntries();
      }
    } catch {
      // offline - Log-Eintrag wird nicht nachgeholt, die eigentliche Änderung bleibt aber erhalten
    }
  }

  const selectedInfo = typeof selectedHive === "number" ? hiveInfo[selectedHive] : undefined;

  // Solange für den ausgewählten Stock noch kein einziger echter Tageseintrag existiert
  // (die automatischen Stammdaten-Änderungsprotokolle zählen nicht mit), zeigt der Button
  // eine einladende Erstformulierung. Sobald der erste Eintrag angelegt wurde, steht beim
  // nächsten Aufruf wieder der normale Text da - ganz ohne eigenes "schon mal besucht"-Flag,
  // einfach weil dann entries.length für diesen Stock > 0 ist.
  const isFirstEntryForSelectedHive =
    typeof selectedHive === "number" &&
    !entries.some((e) => e.hive === selectedHive && !e.notes?.startsWith(STOCK_CHANGE_PREFIX));

  // Zeigt im Stammdaten-Fenster nur an, ob laut dem letzten Tageseintrag mit erfasster
  // Varroamilben-Angabe aktuell "Ja" gilt - verschwindet automatisch, sobald ein neuerer
  // Eintrag "Nein" erfasst. Rein abgeleitet, hier nicht editierbar (nur im Tageseintrag).
  const latestVarroaEntry =
    typeof selectedHive === "number"
      ? entries.find((e) => e.hive === selectedHive && e.varroa_mites !== null && e.varroa_mites !== undefined)
      : undefined;
  const varroaMitesActive = latestVarroaEntry ? !!latestVarroaEntry.varroa_mites : false;

  // Zeigt im Stammdaten-Fenster den zuletzt im Tageseintrag erfassten Stockgewicht-Wert an -
  // bleibt stehen, bis ein neuerer Eintrag einen neuen Wert setzt. Rein abgeleitet, hier
  // nicht editierbar (nur im Tageseintrag).
  const latestWeightEntry =
    typeof selectedHive === "number"
      ? entries.find((e) => e.hive === selectedHive && e.weight_kg !== null && e.weight_kg !== undefined)
      : undefined;
  const latestWeightKg = latestWeightEntry ? Number(latestWeightEntry.weight_kg) : null;

  return (
    <div className="app">
      <LanguageSwitch />
      <header>
        <h1>{t.app.title}</h1>
        <p className="subtitle">{t.app.subtitleDiary(hiveCount)}</p>
        <button
          type="button"
          className="hive-count-toggle"
          onClick={() => {
            setHiveCountInput(String(hiveCount));
            setHiveCountError("");
            setShowHiveCountEditor((v) => !v);
          }}
        >
          {t.app.hiveCountToggle}
        </button>
        {showHiveCountEditor && (
          <form className="hive-count-editor" onSubmit={handleSaveHiveCount}>
            <label>
              {t.app.hiveCountLabel}
              <input
                type="number"
                min={1}
                max={60}
                value={hiveCountInput}
                onChange={(e) => setHiveCountInput(e.target.value)}
                autoFocus
              />
            </label>
            {hiveCountError && <p className="error">{hiveCountError}</p>}
            <div className="hive-count-editor-actions">
              <button type="button" className="secondary" onClick={() => setShowHiveCountEditor(false)}>
                {t.common.cancel}
              </button>
              <button type="submit" disabled={savingHiveCount}>
                {savingHiveCount ? t.common.saving : t.common.save}
              </button>
            </div>
          </form>
        )}
      </header>

      <div className="user-bar">
        <span>{t.app.userGreeting(user.name)}</span>
        {totalUserCount !== null && (
          <span className="admin-user-count" title={t.app.adminOnlyHint}>
            {t.app.totalUsers(totalUserCount)}
          </span>
        )}
        {isAdminUser(user) && (
          <button className="link-btn" onClick={() => setShowAdminPanel(true)}>
            {t.app.manageUsers}
          </button>
        )}
        {!Capacitor.isNativePlatform() && user.webSubscriptionActive && !user.isGifted && (
          <button className="link-btn" onClick={handleManageWebSubscription} disabled={openingBillingPortal}>
            {openingBillingPortal ? t.common.moment : t.app.manageSubscription}
          </button>
        )}
        <button className="link-btn" onClick={onSwitchUser}>
          {t.app.switchUser}
        </button>
      </div>

      {showAdminPanel && <AdminPanel adminUser={user} onClose={() => setShowAdminPanel(false)} />}

      <div className={`status-bar ${isOnline ? "online" : "offline"}`}>
        <span>{isOnline ? t.app.online : t.app.offline}</span>
        {pendingCount > 0 && (
          <span className="pending-info">
            {t.app.pendingInfo(pendingCount)}
            {isOnline && (
              <button className="sync-btn" onClick={trySync} disabled={syncing}>
                {syncing ? t.app.syncing : t.app.syncNow}
              </button>
            )}
          </span>
        )}
      </div>

      <nav className="hive-tabs">
        <button
          className={selectedHive === "all" ? "active" : ""}
          onClick={() => setSelectedHive("all")}
        >
          {t.app.tabAll}
        </button>
        {buildHiveRange(hiveCount).map((h) => {
          const info = hiveInfo[h];
          const color = info?.color;
          const label = info?.name?.trim() || t.common.hiveFallback(h);
          const isActive = selectedHive === h;
          const style = color
            ? isActive
              ? { boxShadow: `0 0 0 3px ${hiveRingColor(color)}` }
              : { background: color, borderColor: hiveRingColor(color), color: readableTextColor(color) }
            : undefined;
          const className = [isActive ? "active" : "", !color ? "unmarked" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={h}
              className={className}
              style={style}
              onClick={() => setSelectedHive(h)}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <div className="harvest-bar">
        <button type="button" className="harvest-open-btn" onClick={() => setShowHarvestPanel(true)}>
          {t.app.harvestEnter}
        </button>
        <button
          type="button"
          className="harvest-year-badge harvest-year-badge-btn"
          onClick={() => setShowHarvestSummary(true)}
        >
          {t.app.harvestYearBadge(harvestYearTotal, new Date().getFullYear())}
        </button>
      </div>

      {showHarvestPanel && (
        <HarvestPanel
          userId={user.id}
          entries={harvestEntries}
          hiveCount={hiveCount}
          hiveInfo={hiveInfo}
          onSaved={loadHarvest}
          onDeleted={loadHarvest}
          onClose={() => setShowHarvestPanel(false)}
        />
      )}

      {showHarvestSummary && (
        <HarvestSummary
          userId={user.id}
          hiveInfo={hiveInfo}
          onClose={() => setShowHarvestSummary(false)}
        />
      )}

      {typeof selectedHive === "number" && (
        <ColorPicker
          hive={selectedHive}
          currentColor={selectedInfo?.color}
          currentName={selectedInfo?.name}
          currentCategory={selectedInfo?.category}
          currentQueenYear={selectedInfo?.queenYear}
          currentColonyStrength={selectedInfo?.colonyStrength}
          varroaMitesActive={varroaMitesActive}
          latestWeightKg={latestWeightKg}
          recentChanges={entries
            .filter((e) => e.hive === selectedHive && e.notes?.startsWith(STOCK_CHANGE_PREFIX))
            .slice(0, 5)}
          onDeleteChange={handleDelete}
          onPickColor={(color) => handleUpdateHive(selectedHive, { color })}
          onRename={(name) => handleUpdateHive(selectedHive, { name })}
          onCategoryChange={(category) => handleUpdateHive(selectedHive, { category })}
          onQueenYearChange={(queenYear) => handleUpdateHive(selectedHive, { queenYear })}
          onColonyStrengthChange={(colonyStrength) => handleUpdateHive(selectedHive, { colonyStrength })}
        />
      )}

      <main>
        {selectedHive === "all" && <p className="muted hint">{t.app.hintPickHive}</p>}
        <section>
          <div className="section-heading-row">
            <h2>{t.app.dailyEntries}</h2>
            {selectedHive !== "all" && (
              <button
                type="button"
                className={`new-entry-toggle ${showNewEntryForm ? "pulsing" : ""}`}
                style={
                  showNewEntryForm && selectedInfo?.color
                    ? ({ "--hive-pulse-color": selectedInfo.color } as any)
                    : undefined
                }
                onClick={() => setShowNewEntryForm((v) => !v)}
              >
                {showNewEntryForm
                  ? t.app.newEntryToggleClose
                  : isFirstEntryForSelectedHive
                  ? t.app.newEntryToggleFirst
                  : t.app.newEntryToggleNormal}
              </button>
            )}
          </div>

          {selectedHive !== "all" && showNewEntryForm && (
            <NewEntryForm
              key={selectedHive}
              userId={user.id}
              hive={selectedHive}
              hiveColor={selectedInfo?.color ?? undefined}
              hiveName={selectedInfo?.name ?? undefined}
              queenYear={selectedInfo?.queenYear ?? null}
              colonyStrength={selectedInfo?.colonyStrength ?? null}
              onCreated={() => {
                loadEntries();
                // Fenster erst schließen, wenn die Biene fertig davongeflogen ist.
                setTimeout(() => setShowNewEntryForm(false), 1300);
              }}
              onClose={() => setShowNewEntryForm(false)}
            />
          )}

          <EntryList
            entries={entries.filter((e) => !e.notes?.startsWith(STOCK_CHANGE_PREFIX))}
            loading={loading}
            userId={user.id}
            onDelete={handleDelete}
            onUpdated={loadEntries}
            hiveInfo={hiveInfo}
          />
        </section>
      </main>

      <footer className="app-legal-footer">
        {!Capacitor.isNativePlatform() && (
          <>
            <button type="button" className="link-btn" onClick={() => setShowInstallGuide(true)}>
              {t.installGuide.trigger}
            </button>
            <span aria-hidden="true">·</span>
          </>
        )}
        <button type="button" className="link-btn" onClick={() => openLegalLink(EULA_URL)}>
          {t.app.eula}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="link-btn" onClick={() => openLegalLink(PRIVACY_URL(lang))}>
          {t.app.privacy}
        </button>
      </footer>

      {showInstallGuide && <InstallGuide onClose={() => setShowInstallGuide(false)} />}
    </div>
  );
}
