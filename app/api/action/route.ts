import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { messages, offers, reviews, tours, users } from "../../../db/schema";
import { getCurrentUser } from "../../local-auth";

export const dynamic = "force-dynamic";
const vehicle = z.enum(["Kombi", "Kamion", "Šleper"]);
const short = z.string().trim().min(2).max(120);
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Korisničko ime: 3–24 mala slova, broja ili donje crte.");
const optional = z.string().trim().max(300).optional().default("");
const date = z.string().refine(v => Number.isFinite(Date.parse(v)), "Neispravan datum.");
const onboard = z.object({ type: z.literal("onboard"), role: z.enum(["company", "driver", "private"]), username, name: short, companyName: z.string().trim().max(120).optional(), homeCity: z.string().trim().max(100).optional(), vehicleKind: vehicle.optional(), phone: z.string().trim().max(30).optional() });
const profile = z.object({ type: z.literal("profile"), username, name: short, companyName: z.string().trim().max(120).optional(), homeCity: z.string().trim().max(100).optional(), vehicleKind: vehicle.optional(), vehicleModel: z.string().trim().max(100).optional(), bio: z.string().trim().max(500).optional(), phone: z.string().trim().max(30).optional() });
const tourCreate = z.object({ type: z.literal("tour.create"), pickupCity: short, pickupAddress: short, pickupNotes: optional, pickupMapUrl: z.string().trim().optional(), dropoffCity: short, dropoffAddress: short, cargoDescription: short, cargoWeight: z.coerce.number().positive().max(25), vehicleKind: z.enum(["Bilo koje", "Kombi", "Kamion", "Šleper"]), price: z.coerce.number().nonnegative().max(1000000), departureAt: date });
const offerUpsert = z.object({ type: z.literal("offer.upsert"), adType: z.enum(["route", "general"]).default("route"), originCity: z.string().trim().max(120).default(""), destinationCity: z.string().trim().max(120).default(""), serviceArea: z.string().trim().max(120).default(""), description: z.string().trim().max(500).default(""), vehicleKind: vehicle, totalCapacity: z.coerce.number().positive().max(25), freeCapacity: z.coerce.number().positive().max(25), alreadyLoaded: z.boolean(), currentCargo: optional, availableAt: date });
const tourRef = z.object({ tourId: z.string().uuid() });
const actionSchema = z.discriminatedUnion("type", [
  onboard, profile, tourCreate, offerUpsert,
  z.object({ type: z.literal("offer.remove") }),
  tourRef.extend({ type: z.literal("tour.accept"), vehicleKind: vehicle.optional(), freeCapacity: z.coerce.number().positive().max(25).optional() }),
  tourRef.extend({ type: z.literal("tour.advance") }),
  tourRef.extend({ type: z.literal("tour.cancel") }),
  tourRef.extend({ type: z.literal("review.create"), score: z.number().int().min(1).max(5), comment: z.string().trim().max(600).optional().default("") }),
  tourRef.extend({ type: z.literal("message.read") }),
  tourRef.extend({ type: z.literal("message.send"), body: z.string().trim().min(1).max(1000) }),
]);
const ok = (data: object = {}) => Response.json({ ok: true, ...data });
const fail = (error: string, status = 400) => Response.json({ error }, { status });
const now = () => new Date().toISOString();

export async function POST(request: Request) {
  const identity = await getCurrentUser();
  if (!identity) return fail("Prijavi se da nastaviš.", 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("Zahtev nije sa ove stranice.", 403);
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("Neispravan zahtev."); }
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Proveri unete podatke.");
  const input = parsed.data;
  try {
    const db = getDb();
    const me = await db.select().from(users).where(eq(users.id, identity.userId)).get();
    if (input.type === "onboard") {
      if (me) return fail("Nalog je već registrovan.", 409);
      if (input.role === "company" && !input.companyName?.trim()) return fail("Unesi naziv firme.");
      if (input.role === "driver" && (!input.homeCity?.trim() || !input.vehicleKind)) return fail("Unesi grad i vozilo.");
      if (await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).get()) return fail("Korisničko ime je zauzeto. Izaberi drugo.", 409);
      const created = await db.insert(users).values({ id: identity.userId, email: identity.email, username: input.username, name: input.role === "company" ? input.companyName!.trim() : input.name, role: input.role, companyName: input.role === "company" ? input.companyName!.trim() : null, homeCity: input.homeCity?.trim() || null, vehicleKind: input.role === "driver" ? input.vehicleKind! : null, phone: input.phone?.trim() || null }).onConflictDoNothing().returning({ id: users.id });
      if (!created.length) return fail("Nalog ili korisničko ime je već registrovano.", 409);
      return ok();
    }
    if (!me) return fail("Prvo izaberi ulogu i dovrši registraciju.", 409);
    if (input.type === "profile") {
      if (me.role === "company" && !input.companyName?.trim()) return fail("Naziv firme je obavezan.");
      const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).get();
      if (taken && taken.id !== me.id) return fail("Korisničko ime je zauzeto. Izaberi drugo.", 409);
      await db.update(users).set({ username: input.username, name: me.role === "company" ? input.companyName!.trim() : input.name, companyName: me.role === "company" ? input.companyName!.trim() : null, homeCity: input.homeCity?.trim() || null, vehicleKind: me.role === "driver" ? (input.vehicleKind ?? me.vehicleKind) : null, vehicleModel: me.role === "driver" ? input.vehicleModel?.trim() || null : null, bio: me.role === "driver" ? input.bio?.trim() || null : null, phone: input.phone?.trim() || null, updatedAt: now() }).where(eq(users.id, me.id));
      return ok();
    }
    if (input.type === "tour.create") {
      if (me.role === "driver") return fail("Samo firma ili privatno lice može da objavi zahtev za prevoz.", 403);
      let mapUrl: string | null = null;
      if (input.pickupMapUrl) {
        try { const u = new URL(input.pickupMapUrl); if (u.protocol !== "https:") return fail("Link do mape mora koristiti HTTPS."); mapUrl = u.href; }
        catch { return fail("Link do mape nije ispravan."); }
      }
      const id = crypto.randomUUID();
      await db.insert(tours).values({ id, companyId: me.id, pickupCity: input.pickupCity, pickupAddress: input.pickupAddress, pickupNotes: input.pickupNotes, pickupMapUrl: mapUrl, dropoffCity: input.dropoffCity, dropoffAddress: input.dropoffAddress, cargoDescription: input.cargoDescription, cargoWeight: input.cargoWeight, vehicleKind: input.vehicleKind, price: input.price, departureAt: input.departureAt });
      return ok({ id });
    }
    if (input.type === "offer.upsert") {
      if (me.role !== "driver") return fail("Samo vozač može da postavi ponudu.", 403);
      if (input.adType === "route" && (input.originCity.length < 2 || input.destinationCity.length < 2)) return fail("Unesi oba grada za oglas sa relacijom.");
      if (input.adType === "general" && (input.serviceArea.length < 2 || input.description.length < 10)) return fail("Unesi područje i kratak opis usluge (najmanje 10 znakova).");
      if (input.freeCapacity > input.totalCapacity) return fail("Slobodan kapacitet ne može biti veći od ukupnog.");
      if (input.alreadyLoaded && (!input.currentCargo || input.freeCapacity >= input.totalCapacity)) return fail("Unesi postojeći teret i preostali kapacitet.");
      const values = { adType: input.adType, originCity: input.adType === "route" ? input.originCity : "", destinationCity: input.adType === "route" ? input.destinationCity : "", serviceArea: input.adType === "general" ? input.serviceArea : "", description: input.description, vehicleKind: input.vehicleKind, totalCapacity: input.totalCapacity, freeCapacity: input.freeCapacity, alreadyLoaded: input.alreadyLoaded, currentCargo: input.alreadyLoaded ? input.currentCargo : "", availableAt: input.availableAt, active: true, updatedAt: now() };
      const reservedWeight = sql<number>`coalesce((select sum(booked.cargo_weight) from tours as booked where booked.driver_id = ${me.id} and booked.status in ('accepted', 'loading', 'in_transit')), 0)`;
      const sameVehicle = sql`not exists (select 1 from tours as booked where booked.driver_id = ${me.id} and booked.status in ('accepted', 'loading', 'in_transit') and booked.vehicle_kind != 'Bilo koje' and booked.vehicle_kind != ${input.vehicleKind})`;
      const existingOffer = await db.select({ id: offers.id }).from(offers).where(eq(offers.driverId, me.id)).get();
      if (existingOffer) {
        const updated = await db.update(offers).set(values)
          .where(and(eq(offers.driverId, me.id), sql`${reservedWeight} <= ${input.freeCapacity}`, sameVehicle))
          .returning({ id: offers.id });
        if (!updated.length) return fail("Već prihvaćene ture zahtevaju isto vozilo i više slobodnog kapaciteta.", 409);
      } else {
        const booked = await db.select({ weight: tours.cargoWeight, vehicleKind: tours.vehicleKind }).from(tours)
          .where(and(eq(tours.driverId, me.id), inArray(tours.status, ["accepted", "loading", "in_transit"])));
        if (booked.some(t => t.vehicleKind !== "Bilo koje" && t.vehicleKind !== input.vehicleKind) || booked.reduce((sum, t) => sum + t.weight, 0) > input.freeCapacity) {
          return fail("Već prihvaćene ture zahtevaju isto vozilo i više slobodnog kapaciteta.", 409);
        }
        const saved = await db.insert(offers).values({ id: crypto.randomUUID(), driverId: me.id, ...values })
          .onConflictDoUpdate({ target: offers.driverId, set: values, setWhere: and(sql`${reservedWeight} <= ${input.freeCapacity}`, sameVehicle) })
          .returning({ id: offers.id });
        if (!saved.length) return fail("Kapacitet je promenjen u međuvremenu. Osveži oglas i pokušaj ponovo.", 409);
      }
      return ok();
    }
    if (input.type === "offer.remove") {
      if (me.role !== "driver") return fail("Ova opcija je za vozače.", 403);
      await db.update(offers).set({ active: false, updatedAt: now() }).where(eq(offers.driverId, me.id)); return ok();
    }
    const tour = await db.select().from(tours).where(eq(tours.id, input.tourId)).get();
    if (!tour) return fail("Tura nije pronađena.", 404);
    if (input.type === "tour.accept") {
      if (me.role !== "driver") return fail("Samo vozač može da prihvati turu.", 403);
      const myOffer = await db.select().from(offers).where(and(eq(offers.driverId, me.id), eq(offers.active, true))).get();
      const chosenVehicle = myOffer?.vehicleKind ?? input.vehicleKind;
      const freeCapacity = myOffer?.freeCapacity ?? input.freeCapacity;
      if (!chosenVehicle || freeCapacity === undefined) return fail("Potvrdi vozilo i slobodan kapacitet pre prihvatanja.");
      if ((tour.vehicleKind !== "Bilo koje" && chosenVehicle !== tour.vehicleKind) || freeCapacity < tour.cargoWeight) return fail("Tura ne odgovara tvom vozilu ili slobodnom kapacitetu.");
      const currentLoads = await db.select({ weight: tours.cargoWeight, vehicleKind: tours.vehicleKind }).from(tours).where(and(eq(tours.driverId, me.id), inArray(tours.status, ["accepted", "loading", "in_transit"])));
      const reserved = currentLoads.reduce((total, row) => total + row.weight, 0);
      if (currentLoads.some(row => row.vehicleKind !== "Bilo koje" && row.vehicleKind !== chosenVehicle)) return fail("Već prihvaćene aktivne ture su za drugo vozilo.", 409);
      if (reserved + tour.cargoWeight > freeCapacity) return fail(`Aktivne ture već zauzimaju ${reserved} t. Potrebno je ukupno ${reserved + tour.cargoWeight} t slobodnog prostora.`, 409);
      const bookedWeight = sql`coalesce((select sum(booked.cargo_weight) from tours as booked
          where booked.driver_id = ${me.id} and booked.status in ('accepted', 'loading', 'in_transit')), 0)`;
      const sameVehicle = sql`not exists (select 1 from tours as booked where booked.driver_id = ${me.id}
          and booked.status in ('accepted', 'loading', 'in_transit') and booked.vehicle_kind != 'Bilo koje' and booked.vehicle_kind != ${chosenVehicle})`;
      const capacityStillAvailable = myOffer ? sql`exists (select 1 from offers as driver_offer where driver_offer.driver_id = ${me.id}
        and driver_offer.active = 1 and (${tour.vehicleKind} = 'Bilo koje' or driver_offer.vehicle_kind = ${tour.vehicleKind})
        and driver_offer.free_capacity >= ${tour.cargoWeight} + ${bookedWeight}) and ${sameVehicle}`
        : sql`not exists (select 1 from offers as driver_offer where driver_offer.driver_id = ${me.id} and driver_offer.active = 1)
          and ${sameVehicle} and ${freeCapacity} >= ${tour.cargoWeight} + ${bookedWeight}`;
      const result = await db.update(tours).set({ driverId: me.id, status: "accepted", updatedAt: now() })
        .where(and(eq(tours.id, tour.id), eq(tours.status, "open"), isNull(tours.driverId), capacityStillAvailable))
        .returning({ id: tours.id });
      if (!result.length) return fail("Tura je već prihvaćena ili se slobodan kapacitet promenio. Osveži prikaz.", 409);
      return ok();
    }
    if (input.type === "tour.advance") {
      if (me.role !== "driver" || tour.driverId !== me.id) return fail("Samo dodeljeni vozač menja status.", 403);
      const next: Record<string, "loading" | "in_transit" | "delivered"> = { accepted: "loading", loading: "in_transit", in_transit: "delivered" };
      const status = next[tour.status]; if (!status) return fail("Tura ne može preći u sledeći status.");
      const updated = await db.update(tours).set({ status, updatedAt: now() }).where(and(eq(tours.id, tour.id), eq(tours.status, tour.status))).returning({ id: tours.id });
      if (!updated.length) return fail("Status je već promenjen. Osveži prikaz.", 409);
      return ok();
    }
    if (input.type === "tour.cancel") {
      if (me.role === "driver" || tour.companyId !== me.id) return fail("Samo osoba koja je objavila turu može da je otkaže.", 403);
      const updated = await db.update(tours).set({ status: "cancelled", updatedAt: now() }).where(and(eq(tours.id, tour.id), eq(tours.status, "open"))).returning({ id: tours.id });
      if (!updated.length) return fail("Može se otkazati samo otvorena tura.", 409);
      return ok();
    }
    if (input.type === "review.create") {
      if (tour.status !== "delivered" || !tour.driverId) return fail("Ocena je moguća posle isporuke.", 409);
      if (tour.driverId !== me.id && tour.companyId !== me.id) return fail("Samo učesnici ture mogu da ocenjuju.", 403);
      const subjectId = me.id === tour.companyId ? tour.driverId : tour.companyId;
      const saved = await db.insert(reviews).values({ id: crypto.randomUUID(), tourId: tour.id, authorId: me.id, subjectId, score: input.score, comment: input.comment })
        .onConflictDoNothing().returning({ id: reviews.id });
      if (!saved.length) return fail("Već si ocenio drugu stranu za ovu turu.", 409);
      return ok();
    }
    if (tour.driverId !== me.id && tour.companyId !== me.id) return fail("Nemaš pristup razgovoru ove ture.", 403);
    if (!tour.driverId) return fail("Razgovor se otvara kada vozač prihvati turu.", 409);
    if (input.type === "message.send") {
      const recipientId = me.id === tour.companyId ? tour.driverId : tour.companyId;
      await db.insert(messages).values({ id: crypto.randomUUID(), tourId: tour.id, senderId: me.id, recipientId, body: input.body });
      return ok();
    }
    if (input.type === "message.read") {
      await db.update(messages).set({ readAt: now() }).where(and(eq(messages.tourId, tour.id), eq(messages.recipientId, me.id), isNull(messages.readAt)));
      return ok();
    }
    return fail("Nepoznata radnja.");
  } catch (error) {
    if (String(error).includes("users.username")) return fail("Korisničko ime je zauzeto. Izaberi drugo.", 409);
    console.error("action error", error);
    return fail("Radnja nije uspela. Pokušaj ponovo.", 500);
  }
}
