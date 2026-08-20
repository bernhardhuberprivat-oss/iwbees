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

// Erstellt eine Stripe-Checkout-Session für das isybee-Monatsabo und gibt die
// Checkout-URL zurück, zu der das Frontend dann per window.location.href
// weiterleitet (src/subscription.ts, startWebCheckout()). Ausschließlich für den
// Web-Build gedacht - die native iOS-App nutzt RevenueCat/StoreKit statt Stripe
// (Apples Anti-Steering-Regel, Guideline 3.1.1: In-App darf nie auf einen externen
// Zahlungsweg verwiesen werden). Diese Function selbst läuft zwar für beide
// Plattformen erreichbar auf dem Server, wird aber vom Frontend nur im Web-Build
// aufgerufen (Capacitor.isNativePlatform()-Weiche in subscription.ts).
const handler = async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return new Response("Web-Abo derzeit nicht verfügbar (fehlende Konfiguration)", { status: 500 });
  }

  const body = await req.json();
  const userId = Number(body.userId);
  if (!userId) {
    return new Response("userId ist erforderlich", { status: 400 });
  }

  const db = getDatabase();
  await ensureSubscriptionColumns(db);

  const [user] = await db.sql`SELECT id, name, stripe_customer_id FROM users WHERE id = ${userId}`;
  if (!user) {
    return new Response("Nutzer nicht gefunden", { status: 404 });
  }

  const origin = req.headers.get("origin") || "https://iwbees.netlify.app";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: user.stripe_customer_id || undefined,
      client_reference_id: String(user.id),
      subscription_data: { metadata: { userId: String(user.id) } },
      metadata: { userId: String(user.id) },
      success_url: `${origin}/?stripe=success`,
      cancel_url: `${origin}/?stripe=cancel`,
    });

    if (!session.url) {
      return new Response("Checkout-Session ohne URL erhalten", { status: 502 });
    }
    return Response.json({ url: session.url });
  } catch (err) {
    console.warn("Stripe-Checkout fehlgeschlagen:", err);
    return new Response("Abo derzeit nicht verfügbar. Bitte später erneut versuchen.", { status: 502 });
  }
};

export const config: Config = {
  path: "/api/stripe-checkout",
};

export default withCors(handler);
