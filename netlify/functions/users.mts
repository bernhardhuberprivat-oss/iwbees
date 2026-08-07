import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

function getPhotoStore() {
  return getStore("bee-photos");
}

const handler = async (req: Request, context: Context) => {
  const db = getDatabase();

  if (req.method === "GET") {
    // Aus Datenschutzgründen sieht niemand mehr die Namen anderer Nutzer:innen - nur
    // noch die Gesamtzahl, damit z. B. der Admin einen groben Überblick hat.
    const [row] = await db.sql`SELECT COUNT(*)::int AS count FROM users`;
    return Response.json({ count: row?.count ?? 0 });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const pin = String(body.pin || "");

    if (!name) {
      return new Response("Name ist erforderlich", { status: 400 });
    }
    if (!/^\d{4}$/.test(pin)) {
      return new Response("PIN muss aus genau 4 Ziffern bestehen", { status: 400 });
    }

    const existing = await db.sql`SELECT id FROM users WHERE lower(name) = lower(${name})`;
    if (existing.length > 0) {
      return new Response("Dieser Nutzername ist bereits vergeben", { status: 409 });
    }

    const [user] = await db.sql`
      INSERT INTO users (name, pin_hash) VALUES (${name}, ${hashPin(pin)})
      RETURNING id, name, hive_count, created_at, is_gifted
    `;

    return Response.json(
      {
        id: user.id,
        name: user.name,
        hiveCount: user.hive_count,
        createdAt: user.created_at,
        isGifted: user.is_gifted,
      },
      { status: 201 }
    );
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const userId = Number(body.userId);
    const hiveCount = Number(body.hiveCount);

    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    if (!hiveCount || !Number.isInteger(hiveCount) || hiveCount < 1 || hiveCount > 60) {
      return new Response("hiveCount muss eine Ganzzahl zwischen 1 und 60 sein", { status: 400 });
    }

    const [user] = await db.sql`
      UPDATE users SET hive_count = ${hiveCount} WHERE id = ${userId}
      RETURNING id, name, hive_count
    `;
    if (!user) {
      return new Response("Nutzer nicht gefunden", { status: 404 });
    }

    return Response.json({ id: user.id, name: user.name, hiveCount: user.hive_count });
  }

  if (req.method === "DELETE") {
    const body = await req.json();
    const pin = String(body.pin || "");
    const userId = body.userId ? Number(body.userId) : null;
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if ((!userId && !name) || !/^\d{4}$/.test(pin)) {
      return new Response("Name (oder userId) und 4-stelliger PIN sind erforderlich", { status: 400 });
    }

    // Login/Löschen läuft jetzt primär über den eingetippten Namen, da die Nutzerliste
    // nicht mehr öffentlich einsehbar ist (siehe GET oben). userId bleibt als Fallback
    // für ältere gespeicherte Sitzungen erhalten.
    const [user] = userId
      ? await db.sql`SELECT id, pin_hash FROM users WHERE id = ${userId}`
      : await db.sql`SELECT id, pin_hash FROM users WHERE lower(name) = lower(${name})`;

    // Bewusst dieselbe Fehlermeldung wie bei falschem PIN, damit sich nicht erraten
    // lässt, ob ein Name überhaupt existiert.
    if (!user || user.pin_hash !== hashPin(pin)) {
      return new Response("Name oder PIN falsch", { status: 401 });
    }
    const resolvedUserId = user.id;

    // Zugehörige Fotos aus dem Blob-Speicher entfernen, bevor die Einträge gelöscht werden.
    const userEntries = await db.sql`SELECT photo_keys FROM entries WHERE user_id = ${resolvedUserId}`;
    const store = getPhotoStore();
    const allKeys = userEntries.flatMap((row) => (row.photo_keys as string[]) || []);
    await Promise.all(allKeys.map((k) => store.delete(k)));

    // Alle abhängigen Daten des Nutzers löschen (keine ON DELETE CASCADE-Regel auf den FKs),
    // erst danach den Nutzer selbst.
    await db.sql`DELETE FROM entries WHERE user_id = ${resolvedUserId}`;
    await db.sql`DELETE FROM hive_colors WHERE user_id = ${resolvedUserId}`;
    await db.sql`DELETE FROM annual_harvest WHERE user_id = ${resolvedUserId}`;
    await db.sql`DELETE FROM harvest_entries WHERE user_id = ${resolvedUserId}`;
    await db.sql`DELETE FROM users WHERE id = ${resolvedUserId}`;

    return new Response(null, { status: 204 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/users",
};

export default withCors(handler);
