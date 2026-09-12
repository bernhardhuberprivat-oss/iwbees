import { useEffect, useState } from "react";
import { CurrentUser } from "./userSession";
import { apiUrl } from "./apiBase";
import { useT, useLang, dateLocale } from "./i18n";

// Übersicht der Sprachnotizen EINES Stocks - erreichbar über den "🎙️ Sprachnotizen"-
// Button in der Stock-Aktionsleiste (App.tsx, neben "📷 Foto-Zeitstrahl"), nur wenn
// das Feature im Kopfmenü aktiviert ist. Aufgenommen wird an anderer Stelle
// (VoiceNoteRecordButton.tsx im Tageseintrag-Formular) - dieses Panel ist reine
// Wiedergabe/Verwaltung, daher kein Rekorder und keine Stock-Auswahl mehr (anders als
// die frühere eigenständige VoiceNotes.tsx, die dieses Panel und den Recorder am
// 12 Sep 2026 ersetzt hat).
interface Props {
  user: CurrentUser;
  hive: number;
  hiveLabel: string;
  onClose: () => void;
}

interface VoiceNoteRow {
  id: number;
  hive: number | null;
  durationSeconds: number | null;
  audioKey: string;
  createdAt: string;
}

export default function VoiceNoteReview({ user, hive, hiveLabel, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const [notes, setNotes] = useState<VoiceNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hive]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNotes() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/voice-notes?userId=${user.id}&hive=${hive}`));
      if (!res.ok) throw new Error();
      setNotes(await res.json());
    } catch {
      setError(t.voiceNotes.errLoad);
    } finally {
      setLoading(false);
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

  return (
    <div className="voice-notes-overlay" onClick={onClose}>
      <div className="voice-notes-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="harvest-panel-close" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>
        <h2 className="harvest-panel-heading">{t.voiceNotes.reviewHeading(hiveLabel)}</h2>

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
