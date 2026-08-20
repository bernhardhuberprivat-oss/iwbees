import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";
import { ensureSubscriptionColumns, isStripeStatusActive } from "./_subscriptionSchema.mts";

// Leichtgewichtiger Refresh-Endpunkt für den Web-Build: nach der Rückkehr von Stripes
// Checkout (oder einfach beim App-Start) fragt das Frontend hier den aktuellen
// Abo-/Trial-Status ab, ohne den PIN erneut abfragen zu müssen (siehe
// src/subscription.ts, refreshWebSubscriptionStatus()). Bewusst KEIN PIN-Schutz wie
// bei /api/users-login: es wird nur ein Boolean + ein Datum preisgegeben, keine
// personenbezogenen Daten (Name, Einträge, Fotos) - ein erratener userId liefert also
// keine sensiblen Informationen, nur ob irgendein Konto ein aktives Abo hat.
const handler = async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const userId = Number(new URL(req.url).searchParams.get("userId"));
  if (!userId) {
    return new Response("userId ist erforderlich", { status: 400 });
  }

  const db = getDatabase();
  await ensureSubscriptionColumns(db);

  const [user] = await db.sql`
    SELECT id, web_trial_start, stripe_subscription_status, is_gifted
    FROM users
    WHERE id = ${userId}
  `;
  if (!user) {
    return new Response("Nutzer nicht gefunden", { status: 404 });
  }

  return Response.json({
    id: user.id,
    webTrialStart: user.web_trial_start,
    webSubscriptionActive: isStripeStatusActive(user.stripe_subscription_status) || Boolean(user.is_gifted),
    isGifted: user.is_gifted,
  });
};

export const config: Config = {
  path: "/api/subscription-status",
};

export default withCors(handler);
