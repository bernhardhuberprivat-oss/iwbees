import { useEffect, useRef, useState } from "react";
import { CurrentUser } from "./userSession";
import { HiveInfo, buildHiveRange } from "./types";
import { apiUrl } from "./apiBase";
import { useT, useLang, dateLocale } from "./i18n";

// Sprachnotizen: eigenstaendige "Schnellnotiz"-Funktion (Menuepunkt im Kopfmenue,
// siehe App.tsx), unabhaengig von einem Tagebucheintrag - gedacht zum freihaendigen
// Aufnehmen direkt am Bienenstock (mit Handschuhen keine Hand frei zum Tippen).
// Bewusst nur Aufnehmen + Abspielen (keine Transkription) und optional einem Stock
// zuordenbar, aber kein eigener Tagebucheintrag. Aufbau/Optik lehnt sich an
// HarvestPanel/PhotoTimeline/AdminPanel an (gleiches Overlay/Panel-Muster).
interface Props {
  user: CurrentUser;
  hiveCount: number;
  hiveInfo: Record<number, HiveInfo>;
  onClose: () => void;
}

interface VoiceNoteRow {
  id: number;
  hive: number | null;
  durationSeconds: number | null;
  audioKey: string;
  createdAt: string;
}

// MediaRecorder-MIME-Typ-Kandidaten in Praeferenzreihenfolge. Chrome/Firefox/Android
// (Web-App) unterstuetzen webm/opus; Safari - und damit auch die native isybee-App,
// die intern per WKWebView rendert - nur mp4/aac. Ohne Treffer faellt es auf den
// Browser-Standard zurueck (kein "mimeType" an den MediaRecorder-Konstruktor).
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VoiceNotes({ user, hiveCount, hiveInfo, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const [notes, setNotes] = useState<VoiceNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [hiveChoice, setHiveChoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const mimeTypeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof MediaRecorder !== "undefined"
    );
    loadNotes();
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (pendingBlob) URL.revokeObjectURL(pendingBlob.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function loadNotes() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/voice-notes?userId=${user.id}`));
      if (!res.ok) throw new Error();
      setNotes(await res.json());
    } catch {
      setError(t.voiceNotes.errLoad);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const duration = (Date.now() - startRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        setPendingBlob({ blob, url: URL.createObjectURL(blob), duration });
        stream.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      startRef.current = Date.now();
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 200);
    } catch {
      setError(t.voiceNotes.errPermission);
    }
  }

  function stopRecording() {
    stopTimer();
    setRecording(false);
    mediaRecorderRef.current?.stop();
  }

  function discardPending() {
    if (pendingBlob) URL.revokeObjectURL(pendingBlob.url);
    setPendingBlob(null);
    setHiveChoice("");
  }

  async function savePending() {
    if (!pendingBlob) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set("userId", String(user.id));
      if (hiveChoice) form.set("hive", hiveChoice);
      form.set("duration", String(Math.round(pendingBlob.duration)));
      const ext = (mimeTypeRef.current || "").includes("mp4") ? "m4a" : "webm";
      form.set("audio", pendingBlob.blob, `sprachnotiz.${ext}`);

      const res = await fetch(apiUrl("/api/voice-notes"), { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const row: VoiceNoteRow = await res.json();
      setNotes((prev) => [row, ...prev]);
      discardPending();
    } catch {
      setError(t.voiceNotes.errUpload);
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(note: VoiceNoteRow) {
    if (!window.confirm(t.voiceNotes.deleteConfirm)) return;
    setBusyId(note.id);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/voice-notes?id=${note.id}&userId=${user.id}`), { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
    } catch {
      setError(t.voiceNotes.errDelete);
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(dateLocale(lang), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function hiveLabel(hive: number | null) {
    if (!hive) return null;
    return hiveInfo[hive]?.name?.trim() || t.common.hiveFallback(hive);
  }

  return (
    <div className="voice-notes-overlay" onClick={onClose}>
      <div className="voice-notes-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>
        <h2 className="harvest-panel-heading">{t.voiceNotes.heading}</h2>

        {!supported && <p className="error">{t.voiceNotes.errUnsupported}</p>}

        {supported && (
          <div className="voice-note-recorder">
            {!pendingBlob && (
              <button
                type="button"
                className={`voice-record-btn${recording ? " recording" : ""}`}
                onClick={recording ? stopRecording : startRecording}
              >
                {recording ? `⏹ ${t.voiceNotes.recording(formatSeconds(elapsed))}` : `🎙️ ${t.voiceNotes.recordStart}`}
              </button>
            )}

            {pendingBlob && (
              <div className="voice-note-preview">
                <audio controls src={pendingBlob.url} />
                <label className="voice-note-hive-label">
                  {t.voiceNotes.hiveLabel}
                  <select value={hiveChoice} onChange={(e) => setHiveChoice(e.target.value)}>
                    <option value="">{t.voiceNotes.hiveNone}</option>
                    {buildHiveRange(hiveCount).map((n) => (
                      <option key={n} value={n}>
                        {hiveInfo[n]?.name?.trim() || t.common.hiveFallback(n)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="voice-note-preview-actions">
                  <button type="button" className="secondary" onClick={discardPending} disabled={saving}>
                    {t.voiceNotes.discardButton}
                  </button>
                  <button type="button" onClick={savePending} disabled={saving}>
                    {saving ? t.voiceNotes.saving : t.voiceNotes.saveButton}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="muted">{t.common.moment}</p>
        ) : notes.length === 0 ? (
          <p className="muted">{t.voiceNotes.empty}</p>
        ) : (
          <ul className="voice-note-list">
            {notes.map((note) => (
              <li key={note.id} className="voice-note-item">
                <div className="voice-note-item-meta">
                  <span className="voice-note-item-date">{formatDate(note.createdAt)}</span>
                  {hiveLabel(note.hive) && <span className="hive-badge">{hiveLabel(note.hive)}</span>}
                </div>
                <audio controls src={apiUrl(`/api/voice-note-audio?key=${note.audioKey}`)} />
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => deleteNote(note)}
                  disabled={busyId === note.id}
                >
                  {busyId === note.id ? "…" : t.voiceNotes.deleteBtn}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
