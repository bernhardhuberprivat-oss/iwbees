import { useEffect, useRef, useState } from "react";
import { apiUrl } from "./apiBase";
import { useT } from "./i18n";

// Größeres Mikrofon-Symbol im Tageseintrag-Formular (NewEntryForm.tsx) - nur sichtbar,
// wenn das Sprachnotizen-Feature im Kopfmenü aktiviert ist (siehe voiceNotesPref.ts).
// Anders als die frühere eigenständige Sprachnotizen-Übersicht (VoiceNotes.tsx, seit
// 12 Sep 2026 aufgeteilt in diesen Recorder + VoiceNoteReview.tsx) gibt es hier KEINE
// Stock-Auswahl mehr: die Zuordnung ergibt sich automatisch aus dem Stock, für den
// gerade der Tageseintrag ausgefüllt wird (Prop "hive").
interface Props {
  userId: number;
  hive: number;
}

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

export default function VoiceNoteRecordButton({ userId, hive }: Props) {
  const t = useT();
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (pendingBlob) URL.revokeObjectURL(pendingBlob.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setError("");
    setSaved(false);
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
  }

  async function savePending() {
    if (!pendingBlob) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set("userId", String(userId));
      form.set("hive", String(hive));
      form.set("duration", String(Math.round(pendingBlob.duration)));
      const ext = (mimeTypeRef.current || "").includes("mp4") ? "m4a" : "webm";
      form.set("audio", pendingBlob.blob, `sprachnotiz.${ext}`);

      const res = await fetch(apiUrl("/api/voice-notes"), { method: "POST", body: form });
      if (!res.ok) throw new Error();
      discardPending();
      setSaved(true);
    } catch {
      setError(t.voiceNotes.errUpload);
    } finally {
      setSaving(false);
    }
  }

  if (!supported) {
    return <p className="error voice-note-inline-error">{t.voiceNotes.errUnsupported}</p>;
  }

  return (
    <div className="voice-note-record-inline">
      {!pendingBlob && (
        <button
          type="button"
          className={`voice-record-btn large${recording ? " recording" : ""}`}
          onClick={recording ? stopRecording : startRecording}
        >
          <span className="voice-record-btn-icon" aria-hidden="true">
            {recording ? "⏹" : "🎙️"}
          </span>
          {recording ? t.voiceNotes.recording(formatSeconds(elapsed)) : t.voiceNotes.recordStart}
        </button>
      )}

      {pendingBlob && (
        <div className="voice-note-preview">
          <audio controls src={pendingBlob.url} />
          {/* Grosser, auffaelliger Button statt der bisherigen kleinen "Speichern"-
              Schaltflaeche unten - die wurde von Bernhard leicht uebersehen (12 Sep 2026
              Feedback: Sprachnotiz aufgenommen, aber nie gespeichert, weil der Text zu
              klein/unauffaellig war). Uebernimmt optisch denselben Stil wie der
              Aufnahme-Button oben, damit er als naechster Schritt sofort ins Auge faellt. */}
          <button
            type="button"
            className="voice-record-btn large voice-save-prompt"
            onClick={savePending}
            disabled={saving}
          >
            <span className="voice-record-btn-icon" aria-hidden="true">
              💾
            </span>
            {saving ? t.voiceNotes.saving : t.voiceNotes.saveButton}
          </button>
          <button type="button" className="voice-note-discard-link" onClick={discardPending} disabled={saving}>
            {t.voiceNotes.discardButton}
          </button>
        </div>
      )}

      {saved && <p className="info voice-note-inline-saved">{t.voiceNotes.saved}</p>}
      {error && <p className="error voice-note-inline-error">{error}</p>}
    </div>
  );
}
