import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

// Backend fuer die Sprachnotizen ("Schnellnotiz"-Feature, unabhaengig von einem
// Tagebucheintrag) - Aufbau bewusst analog zu entries.mts/photo.mts: die eigentlichen
// Audio-Bytes liegen in einem eigenen Netlify-Blobs-Store ("bee-voice-notes", getrennt
// von "bee-photos"), die DB-Zeile haelt nur Metadaten + den Blob-Key. Ausliefern der
// Bytes passiert in voice-note-audio.mts (eigene Function, wie photo.mts fuer Fotos).
function getVoiceNoteStore() {
  return getStore("bee-voice-notes");
}

function toRow(row: any) {
  return {
    id: row.id,
    hive: row.hive ?? null,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    audioKey: row.audio_key,
    createdAt: row.created_at,
  };
}

const handler = async (req: Request, context: Context) => {
  const db = getDatabase();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    const hiveParam = url.searchParams.get("hive");
    const rows = hiveParam
      ? await db.sql`SELECT * FROM voice_notes WHERE user_id = ${userId} AND hive = ${Number(hiveParam)} ORDER BY created_at DESC, id DESC`
      : await db.sql`SELECT * FROM voice_notes WHERE user_id = ${userId} ORDER BY created_at DESC, id DESC`;
    return Response.json(rows.map(toRow));
  }

  if (req.method === "POST") {
    const form = await req.formData();
    const userId = Number(form.get("userId"));
    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    const hiveRaw = form.get("hive");
    const hive = hiveRaw ? Number(hiveRaw) : null;
    if (hive !== null && (hive < 1 || hive > 60)) {
      return new Response("hive muss zwischen 1 und 60 liegen", { status: 400 });
    }
    const durationRaw = form.get("duration");
    const durationSeconds = durationRaw ? Number(durationRaw) : null;

    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return new Response("audio ist erforderlich", { status: 400 });
    }
    // Grobe Groessenbremse (ca. 15 MB) - eine Sprachnotiz sollte eine kurze Aufnahme
    // sein, keine stundenlange Datei; schuetzt Blob-Storage und die Lambda-Anfragegrenze.
    if (audio.size > 15 * 1024 * 1024) {
      return new Response("Aufnahme ist zu groß (max. 15 MB)", { status: 413 });
    }

    const key = randomUUID();
    const store = getVoiceNoteStore();
    await store.set(key, await audio.arrayBuffer(), {
      metadata: { contentType: audio.type || "audio/webm" },
    });

    const [row] = await db.sql`
      INSERT INTO voice_notes (user_id, hive, duration_seconds, audio_key)
      VALUES (${userId}, ${hive}, ${durationSeconds}, ${key})
      RETURNING *
    `;

    return Response.json(toRow(row), { status: 201 });
  }

  if (req.method === "DELETE") {
    const id = Number(url.searchParams.get("id"));
    const userId = Number(url.searchParams.get("userId"));
    if (!id || !userId) {
      return new Response("id und userId sind erforderlich", { status: 400 });
    }

    const [row] = await db.sql`SELECT audio_key FROM voice_notes WHERE id = ${id} AND user_id = ${userId}`;
    if (row) {
      const store = getVoiceNoteStore();
      await store.delete(row.audio_key);
    }

    await db.sql`DELETE FROM voice_notes WHERE id = ${id} AND user_id = ${userId}`;
    return new Response(null, { status: 204 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/voice-notes",
};

export default withCors(handler);
