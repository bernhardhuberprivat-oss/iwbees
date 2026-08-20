import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";
import { ensureSubscriptionColumns } from "./_subscriptionSchema.mts";
import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
  return new Stripe(key);
}

// Öffnet Stripes "Customer Portal" für Nutzer:innen, die bereits ein Web-Abo
// abgeschlossen haben - dort können sie selbst kündigen, die Zahlungsmethode
// ändern oder Rechnungen einsehen, ohne dass wir das selbst bauen müssen. Nur
// aufrufbar, wenn schon eine stripe_customer_id existiert (siehe
// stripe-webhook.mts, checkout.session.completed).
const handler = async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await req.json();
  const userId = Number(body.userId);
  if (!userId) {
    return new Response("userId ist erforderlich", { status: 400 });
  }

  const db = getDatabase();
  await ensureSubscriptionColumns(db);

  const [user] = await db.sql`SELECT id, stripe_customer_id FROM users WHERE id = ${userId}`;
  if (!user) {
    return new Response("Nutzer nicht gefunden", { status: 404 });
  }
  if (!user.stripe_customer_id) {
    return new Response("Kein Stripe-Kundenkonto für diesen Nutzer gefunden", { status: 404 });
  }

  const origin = req.headers.get("origin") || "https://iwbees.netlify.app";

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${origin}/`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.warn("Stripe-Portal fehlgeschlagen:", err);
    return new Response("Abo-Verwaltung derzeit nicht verfügbar. Bitte später erneut versuchen.", { status: 502 });
  }
};

export const config: Config = {
  path: "/api/stripe-portal",
};

export default withCors(handler);
