import { desc, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { messages, offers, reviews, tours, users, vehiclePhotos } from "../../../db/schema";
import { getCurrentUser } from "../../local-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getCurrentUser();
  if (!identity) return Response.json({ error: "Prijavi se da preuzmeš svoje podatke." }, { status: 401 });

  try {
    const db = getDb();
    const account = await db.select().from(users).where(eq(users.id, identity.userId)).get();
    if (!account) return Response.json({ error: "Nalog nije pronađen." }, { status: 404 });

    const myTours = account.role !== "driver"
      ? await db.select().from(tours).where(eq(tours.companyId, account.id)).orderBy(desc(tours.createdAt))
      : await db.select().from(tours).where(eq(tours.driverId, account.id)).orderBy(desc(tours.createdAt));
    const myOffer = account.role === "driver"
      ? await db.select().from(offers).where(eq(offers.driverId, account.id)).get()
      : null;
    const myMessages = await db.select().from(messages)
      .where(or(eq(messages.senderId, account.id), eq(messages.recipientId, account.id)))
      .orderBy(desc(messages.createdAt));
    const myReviews = await db.select().from(reviews)
      .where(or(eq(reviews.authorId, account.id), eq(reviews.subjectId, account.id))).orderBy(desc(reviews.createdAt));
    const myVehiclePhotos = await db.select({ id: vehiclePhotos.id, position: vehiclePhotos.position, createdAt: vehiclePhotos.createdAt }).from(vehiclePhotos).where(eq(vehiclePhotos.driverId, account.id));
    const payload = { formatVersion: 3, exportedAt: new Date().toISOString(), account, tours: myTours, offer: myOffer, messages: myMessages, reviews: myReviews, vehiclePhotos: myVehiclePhotos };
    const day = new Date().toISOString().slice(0, 10);

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="lst-ruta-podaci-${day}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("export error", error);
    return Response.json({ error: "Podaci trenutno nisu dostupni za preuzimanje." }, { status: 500 });
  }
}
