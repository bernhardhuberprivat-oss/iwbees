import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

function getPhotoStore() {
  return getStore("bee-photos");
}

export default async (req: Request, context: Context) => {
  const db = getDatabase();

  if (req.method === "GET") {
    const users = await db.sql`SELECT id, name FROM users ORDER BY name`;
    return Response.json(users);
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
      RETURNING id, name
    `;

    return Response.json(user, { status: 201 });
  }

  if (req.method === "DELETE") {
    const body = await req.json();
    const userId = Number(body.userId);
    const pin = String(body.pin || "");

    if (!userId || !/^\d{4}$/.test(pin)) {
      return new Response("userId und 4-stelliger PIN sind erforderlich", { status: 400 });
    }

    const [user] = await db.sql`SELECT id, pin_hash FROM users WHERE id = ${userId}`;
    if (!user) {
      return new Response("Nutzer nicht gefunden", { status: 404 });
    }
    if (user.pin_hash !== hashPin(pin)) {
      return new Response("Falscher PIN", { status: 401 });
    }

    // Zugehörige Fotos aus dem Blob-Speicher entfernen, bevor die Einträge gelöscht werden.
    const userEntries = await db.sql`SELECT photo_keys FROM entries WHERE user_id = ${userId}`;
    const store = getPhotoStore();
    const allKeys = userEntries.flatMap((row) => (row.photo_keys as string[]) || []);
    await Promise.all(allKeys.map((k) => store.delete(k)));

    // Alle abhängigen Daten des Nutzers löschen (keine ON DELETE CASCADE-Regel auf den FKs),
    // erst danach den Nutzer selbst.
    await db.sql`DELETE FROM entries WHERE user_id = ${userId}`;
    await db.sql`DELETE FROM hive_colors WHERE user_id = ${userId}`;
    await db.sql`DELETE FROM annual_harvest WHERE user_id = ${userId}`;
    await db.sql`DELETE FROM users WHERE id = ${userId}`;

    return new Response(null, { status: 204 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/users",
};
