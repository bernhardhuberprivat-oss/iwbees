import type { Context, Config } from "@netlify/functions";
import { withCors } from "./_cors.mts";
import { getDatabase } from "@netlify/database";

const handler = async (req: Request, context: Context) => {
  const db = getDatabase();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    const rows = await db.sql`SELECT year, kg FROM annual_harvest WHERE user_id = ${userId} ORDER BY year DESC`;
    return Response.json(rows);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const userId = Number(body.userId);
    const year = Number(body.year);
    const kg = body.kg === null || body.kg === undefined || body.kg === "" ? null : Number(body.kg);

    if (!userId) {
      return new Response("userId ist erforderlich", { status: 400 });
    }
    if (!year || year < 2000 || year > 2100) {
      return new Response("Ein gültiges Jahr ist erforderlich", { status: 400 });
    }

    await db.sql`
      INSERT INTO annual_harvest (user_id, year, kg) VALUES (${userId}, ${year}, ${kg})
      ON CONFLICT (user_id, year) DO UPDATE SET kg = ${kg}
    `;

    return Response.json({ year, kg });
  }

  if (req.method === "DELETE") {
    const userId = Number(url.searchParams.get("userId"));
    const year = Number(url.searchParams.get("year"));
    if (!userId || !year) {
      return new Response("userId und year sind erforderlich", { status: 400 });
    }
    await db.sql`DELETE FROM annual_harvest WHERE user_id = ${userId} AND year = ${year}`;
    return new Response(null, { status: 204 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/harvest",
};

export default withCors(handler);
