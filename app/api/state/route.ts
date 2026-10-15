import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { messages, offers, passwordAccounts, reviews, tours, users, vehiclePhotos } from "../../../db/schema";
import { getCurrentUser } from "../../local-auth";

export const dynamic = "force-dynamic";
const batchSize = 80;

export async function GET() {
  const identity = await getCurrentUser();
  if (!identity) return Response.json({ error: "Prijavi se da nastaviš." }, { status: 401 });
  try {
    const db = getDb();
    const me = await db.select().from(users).where(eq(users.id, identity.userId)).get();
    if (!me) return Response.json({ needsRegistration: true, email: identity.email }, { status: 409 });

    const tourRows = me.role !== "driver"
      ? await db.select().from(tours).where(eq(tours.companyId, me.id)).orderBy(desc(tours.createdAt)).limit(200)
      : await db.select().from(tours).where(or(eq(tours.status, "open"), eq(tours.driverId, me.id))).orderBy(desc(tours.createdAt)).limit(200);
    const offerRows = me.role !== "driver"
      ? await db.select().from(offers).where(eq(offers.active, true)).orderBy(desc(offers.updatedAt)).limit(200)
      : await db.select().from(offers).where(eq(offers.driverId, me.id)).limit(1);
    const reservedRows: { driverId: string | null; weight: number }[] = [];
    const offerDriverIds = offerRows.map(o => o.driverId);
    for (let i = 0; i < offerDriverIds.length; i += batchSize) {
      const rows = await db.select({ driverId: tours.driverId, weight: sql<number>`coalesce(sum(${tours.cargoWeight}), 0)` })
        .from(tours).where(and(inArray(tours.driverId, offerDriverIds.slice(i, i + batchSize)), inArray(tours.status, ["accepted", "loading", "in_transit"])))
        .groupBy(tours.driverId);
      reservedRows.push(...rows);
    }
    const reservedByDriver = new Map(reservedRows.map(row => [row.driverId, row.weight]));
    const availableOffers = offerRows.map(offer => ({ ...offer, availableCapacity: Math.max(0, offer.freeCapacity - (reservedByDriver.get(offer.driverId) ?? 0)) }));
    const messageRows = await db.select().from(messages)
      .where(or(eq(messages.senderId, me.id), eq(messages.recipientId, me.id)))
      .orderBy(desc(messages.createdAt)).limit(300);
    const ids = new Set<string>([me.id]);
    for (const tour of tourRows) { ids.add(tour.companyId); if (tour.driverId) ids.add(tour.driverId); }
    for (const offer of offerRows) ids.add(offer.driverId);
    for (const msg of messageRows) { ids.add(msg.senderId); ids.add(msg.recipientId); }
    const people: Pick<typeof users.$inferSelect, "id" | "name" | "role" | "companyName" | "homeCity" | "vehicleKind" | "username" | "vehicleModel" | "bio" | "avatarKey" | "updatedAt">[] = [];
    const personIds = [...ids];
    for (let i = 0; i < personIds.length; i += batchSize) {
      const rows = await db.select({ id: users.id, name: users.name, role: users.role, companyName: users.companyName, homeCity: users.homeCity, vehicleKind: users.vehicleKind, username: users.username, vehicleModel: users.vehicleModel, bio: users.bio, avatarKey: users.avatarKey, updatedAt: users.updatedAt })
        .from(users).where(inArray(users.id, personIds.slice(i, i + batchSize)));
      people.push(...rows);
    }
    const ratingRows: { subjectId: string; average: number; count: number }[] = [];
    for (let i = 0; i < personIds.length; i += batchSize) {
      const rows = await db.select({ subjectId: reviews.subjectId, average: sql<number>`avg(${reviews.score})`, count: sql<number>`count(*)` })
        .from(reviews).where(inArray(reviews.subjectId, personIds.slice(i, i + batchSize))).groupBy(reviews.subjectId);
      ratingRows.push(...rows);
    }
    const ratingById = new Map(ratingRows.map(row => [row.subjectId, row]));
    const ratedPeople = people.map(({ avatarKey, ...person }) => ({ ...person, hasAvatar: !!avatarKey, ratingAverage: Number(ratingById.get(person.id)?.average ?? 0), ratingCount: Number(ratingById.get(person.id)?.count ?? 0) }));
    const photos: { id: string; driverId: string; position: number }[] = [];
    const driverIds = people.filter(p => p.role === "driver").map(p => p.id);
    for (let i = 0; i < driverIds.length; i += batchSize) {
      const rows = await db.select({ id: vehiclePhotos.id, driverId: vehiclePhotos.driverId, position: vehiclePhotos.position })
        .from(vehiclePhotos).where(inArray(vehiclePhotos.driverId, driverIds.slice(i, i + batchSize))).orderBy(vehiclePhotos.position);
      photos.push(...rows);
    }
    const myReviews = await db.select({ tourId: reviews.tourId, score: reviews.score, comment: reviews.comment, subjectId: reviews.subjectId })
      .from(reviews).where(eq(reviews.authorId, me.id)).orderBy(desc(reviews.createdAt)).limit(200);
    const recentReviews: { subjectId: string; score: number; comment: string; createdAt: string }[] = [];
    for (let i = 0; i < personIds.length; i += batchSize) {
      const rows = await db.select({ subjectId: reviews.subjectId, score: reviews.score, comment: reviews.comment, createdAt: reviews.createdAt })
        .from(reviews).where(and(inArray(reviews.subjectId, personIds.slice(i, i + batchSize)), ne(reviews.comment, "")))
        .orderBy(desc(reviews.createdAt)).limit(100);
      recentReviews.push(...rows);
    }
    const hasPassword = !!await db.select({ userId: passwordAccounts.userId }).from(passwordAccounts).where(eq(passwordAccounts.userId, me.id)).get();
    return Response.json({ me, tours: tourRows, offers: availableOffers, messages: messageRows.reverse(), people: ratedPeople, vehiclePhotos: photos, myReviews, recentReviews, auth: { hasPassword, source: identity.source } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("state error", error);
    return Response.json({ error: "Podaci trenutno nisu dostupni. Pokušaj ponovo." }, { status: 500 });
  }
}
