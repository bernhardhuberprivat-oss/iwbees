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
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    const entries = await db.sql`
      SELECT id, entry_date, kg, hive FROM harvest_entries
      WHERE user_id = ${userId}
      ORDER BY entry_date DESC, id DESC
      LIMIT 40
    `;

    const [totalRow] = await db.sql`
      SELECT COALESCE(SUM(kg), 0) AS total FROM harvest_entries
      WHERE user_id = ${userId} AND EXTRACT(YEAR FROM entry_date) = ${year}
    `;

    // Für die Auswertung (Klick auf den Ertrags-Badge): Summe je Stock im gewählten Jahr,
    // separat die Summe der "Gesamt"-Einträge (ohne Stock-Zuordnung, hive IS NULL), sowie
    // alle Jahre, für die überhaupt Erträge erfasst sind (für die Jahresauswahl dort).
    const perHiveRows = await db.sql`
      SELECT hive, COALESCE(SUM(kg), 0) AS kg FROM harvest_entries
      WHERE user_id = ${userId} AND EXTRACT(YEAR FROM entry_date) = ${year} AND hive IS NOT NULL
      GROUP BY hive
      ORDER BY hive
    `;

    const [gesamtOnlyRow] = await db.sql`
      SELECT COALESCE(SUM(kg), 0) AS kg FROM harvest_entries
      WHERE user_id = ${userId} AND EXTRACT(YEAR FROM entry_date) = ${year} AND hive IS NULL
    `;

    const yearRows = await db.sql`
      SELECT DISTINCT EXTRACT(YEAR FROM entry_date)::int AS year FROM harvest_entries
      WHERE user_id = ${userId}
      ORDER BY year DESC
    `;

    return Response.json({
      entries,
      yearTotal: Number(totalRow?.total || 0),
      year,
      perHive: perHiveRows.map((r) => ({ hive: Number(r.hive), kg: Number(r.kg) })),
      gesamtOnlyKg: Number(gesamtOnlyRow?.kg || 0),
      years: yearRows.map((r) => Number(r.year)),
    });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const userId = Number(body.userId);
    const entryDate = String(body.entryDate || "");
    const kg = Number(body.kg);
    // hive = null bedeutet "Gesamtertrag" (wie bisher), eine Zahl bedeutet Ertrag für
    // genau diesen einen Stock.
    const hive =
      body.hive === null || body.hive === undefined || body.hive === "" ? null : Number(body.hive);

    if (!userId || !entryDate) {
      return new Response("userId und entryDate sind erforderlich", { status: 400 });
    }
    if (!kg || kg <= 0) {
      return new Response("kg muss eine positive Zahl sein", { status: 400 });
    }
    if (hive !== null && (!Number.isInteger(hive) || hive < 1)) {
      return new Response("hive muss eine positive ganze Zahl sein", { status: 400 });
    }

    const [row] = await db.sql`
      INSERT INTO harvest_entries (user_id, entry_date, kg, hive)
      VALUES (${userId}, ${entryDate}, ${kg}, ${hive})
      RETURNING id, entry_date, kg, hive
    `;

    return Response.json(row, { status: 201 });
  }

  if (req.method === "DELETE") {
    const id = Number(url.searchParams.get("id"));
    const userId = Number(url.searchParams.get("userId"));
    if (!id || !userId) {
      return new Response("id und userId sind erforderlich", { status: 400 });
    }
    await db.sql`DELETE FROM harvest_entries WHERE id = ${id} AND user_id = ${userId}`;
    return new Response(null, { status: 204 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/harvest-entries",
};

export default withCors(handler);
