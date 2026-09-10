import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

function cleanGuest(input: any) {
  return {
    name: String(input?.name || "").trim().slice(0, 180),
    phone: String(input?.phone || "").trim().slice(0, 40),
  };
}

export default async (req: Request) => {
  if (!["POST", "DELETE", "PATCH"].includes(req.method)) return new Response("Method Not Allowed", { status: 405 });
  try {
    const data = await req.json();
    const db = getDatabase();


    if (req.method === "PATCH") {
      if (!data.eventId || !data.ownerToken || !data.guestId) return Response.json({ error: "بيانات التحديث ناقصة" }, { status: 400 });
      const [event] = await db.sql`SELECT id FROM events WHERE id=${String(data.eventId)} AND owner_token=${String(data.ownerToken)}`;
      if (!event) return Response.json({ error: "غير مصرح" }, { status: 403 });
      const paymentStatus = data.paymentStatus === "paid" ? "paid" : "unpaid";
      const [guest] = await db.sql`
        UPDATE guests
        SET payment_status=${paymentStatus},
            payment_amount=CASE WHEN ${paymentStatus}='paid' THEN share_total ELSE 0 END,
            paid_at=CASE WHEN ${paymentStatus}='paid' THEN NOW() ELSE NULL END
        WHERE id=${String(data.guestId)} AND event_id=${String(data.eventId)}
        RETURNING id, payment_status, payment_amount, paid_at
      `;
      if (!guest) return Response.json({ error: "الضيف غير موجود" }, { status: 404 });
      return Response.json({ guest });
    }

    if (req.method === "DELETE") {
      if (!data.eventId || !data.ownerToken || !data.guestId) return Response.json({ error: "بيانات الحذف ناقصة" }, { status: 400 });
      const [event] = await db.sql`SELECT id FROM events WHERE id=${String(data.eventId)} AND owner_token=${String(data.ownerToken)}`;
      if (!event) return Response.json({ error: "غير مصرح" }, { status: 403 });
      const [guest] = await db.sql`DELETE FROM guests WHERE id=${String(data.guestId)} AND event_id=${String(data.eventId)} RETURNING id`;
      if (!guest) return Response.json({ error: "الضيف غير موجود" }, { status: 404 });
      return Response.json({ ok: true });
    }

    if (!data.eventId || !data.ownerToken) return Response.json({ error: "بيانات المناسبة ناقصة" }, { status: 400 });
    const [event] = await db.sql`SELECT id FROM events WHERE id=${String(data.eventId)} AND owner_token=${String(data.ownerToken)}`;
    if (!event) return Response.json({ error: "غير مصرح" }, { status: 403 });

    if (Array.isArray(data.guests)) {
      const guests = data.guests.map(cleanGuest).filter((g: { name: string }) => g.name).slice(0, 1000);
      if (!guests.length) return Response.json({ error: "لا توجد أسماء صالحة للاستيراد" }, { status: 400 });
      const client = await db.pool.connect();
      const created = [];
      try {
        await client.query("BEGIN");
        for (const g of guests) {
          const id = crypto.randomUUID();
          const code = makeCode();
          const result = await client.query(
            `INSERT INTO guests (id, event_id, name, phone, code) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,phone,code,rsvp_status,created_at`,
            [id, String(data.eventId), g.name, g.phone, code]
          );
          created.push(result.rows[0]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return Response.json({ guests: created, count: created.length });
    }

    const single = cleanGuest(data);
    if (!single.name) return Response.json({ error: "بيانات الضيف ناقصة" }, { status: 400 });
    const id = crypto.randomUUID();
    const code = makeCode();
    const [guest] = await db.sql`
      INSERT INTO guests (id, event_id, name, phone, code)
      VALUES (${id}, ${String(data.eventId)}, ${single.name}, ${single.phone}, ${code})
      RETURNING id, name, phone, code, rsvp_status, created_at
    `;
    return Response.json({ guest, invitePath: `/i/${code}` });
  } catch (error) {
    console.error(error);
    return Response.json({ error: req.method === "DELETE" ? "تعذر حذف الضيف" : "تعذر إضافة الضيوف" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/guests" };
