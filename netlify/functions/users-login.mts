import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";
import { createHash } from "node:crypto";
import { ensureSubscriptionColumns, isStripeStatusActive } from "./_subscriptionSchema.mts";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

const handler = async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const db = getDatabase();
  await ensureSubscriptionColumns(db);

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
    ? await db.sql`SELECT id, name, pin_hash, hive_count, created_at, is_gifted, web_trial_start, stripe_subscription_status FROM users WHERE id = ${userId}`
    : await db.sql`SELECT id, name, pin_hash, hive_count, created_at, is_gifted, web_trial_start, stripe_subscription_status FROM users WHERE lower(name) = lower(${name})`;

  // Bewusst dieselbe Fehlermeldung, egal ob der Name nicht existiert oder der PIN falsch
  // ist - so lässt sich nicht erraten, welche Namen es in der App überhaupt gibt.
  if (!user || user.pin_hash !== hashPin(pin)) {
    return new Response("Name oder PIN falsch", { status: 401 });
  }

  // Bestandskonten (von vor der Web-Abo-Einführung) haben noch kein web_trial_start -
  // wird beim allerersten Login nach dem Rollout einmalig nachgetragen ("ab Umstellung"
  // heißt hier konkret: ab dem ersten Öffnen der Web-App nach dem Update). COALESCE
  // macht das idempotent - bei jedem weiteren Login passiert nichts mehr.
  let webTrialStart = user.web_trial_start;
  if (!webTrialStart) {
    const [updated] = await db.sql`
      UPDATE users SET web_trial_start = COALESCE(web_trial_start, NOW())
      WHERE id = ${user.id}
      RETURNING web_trial_start
    `;
    webTrialStart = updated?.web_trial_start ?? webTrialStart;
  }

  return Response.json({
    id: user.id,
    name: user.name,
    hiveCount: user.hive_count,
    createdAt: user.created_at,
    isGifted: user.is_gifted,
    webTrialStart,
    webSubscriptionActive: isStripeStatusActive(user.stripe_subscription_status) || Boolean(user.is_gifted),
  });
};

export const config: Config = {
  path: "/api/users-login",
};

export default withCors(handler);
