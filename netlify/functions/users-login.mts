import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";
import { createHash } from "node:crypto";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

const handler = async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const db = getDatabase();
  const body = await req.json();
  const pin = String(body.pin || "");
  const userId = body.userId ? Number(body.userId) : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if ((!userId && !name) || !/^\d{4}$/.test(pin)) {
    return new Response("Name (oder userId) und 4-stelliger PIN sind erforderlich", { status: 400 });
  }

  // Anmeldung läuft jetzt primär über den eingetippten Namen, da die Nutzerliste aus
  // Datenschutzgründen nicht mehr öffentlich abrufbar ist. userId bleibt als Fallback
  // für bereits gespeicherte Sitzungen (z. B. "erneut prüfen") erhalten.
  const [user] = userId
    ? await db.sql`SELECT id, name, pin_hash, hive_count, created_at, is_gifted FROM users WHERE id = ${userId}`
    : await db.sql`SELECT id, name, pin_hash, hive_count, created_at, is_gifted FROM users WHERE lower(name) = lower(${name})`;

  // Bewusst dieselbe Fehlermeldung, egal ob der Name nicht existiert oder der PIN falsch
  // ist - so lässt sich nicht erraten, welche Namen es in der App überhaupt gibt.
  if (!user || user.pin_hash !== hashPin(pin)) {
    return new Response("Name oder PIN falsch", { status: 401 });
  }

  return Response.json({
    id: user.id,
    name: user.name,
    hiveCount: user.hive_count,
    createdAt: user.created_at,
    isGifted: user.is_gifted,
  });
};

export const config: Config = {
  path: "/api/users-login",
};

export default withCors(handler);
