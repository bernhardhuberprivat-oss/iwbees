import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { createHash } from "node:crypto";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const db = getDatabase();
  const body = await req.json();
  const userId = Number(body.userId);
  const pin = String(body.pin || "");

  if (!userId || !/^\d{4}$/.test(pin)) {
    return new Response("userId und 4-stelliger PIN sind erforderlich", { status: 400 });
  }

  const [user] = await db.sql`SELECT id, name, pin_hash, hive_count FROM users WHERE id = ${userId}`;
  if (!user || user.pin_hash !== hashPin(pin)) {
    return new Response("Falscher PIN", { status: 401 });
  }

  return Response.json({ id: user.id, name: user.name, hiveCount: user.hive_count });
};

export const config: Config = {
  path: "/api/users-login",
};
