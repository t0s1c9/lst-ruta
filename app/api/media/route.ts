import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users, vehiclePhotos } from "../../../db/schema";
import { getCurrentUser } from "../../local-auth";

export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) => Response.json({ error }, { status });
const maxBytes = 5 * 1024 * 1024;

function imageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length > 8 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) return { mime: "image/png", ext: "png" };
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

async function account(request: Request) {
  const identity = await getCurrentUser();
  if (!identity) return null;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return null;
  const me = await getDb().select().from(users).where(eq(users.id, identity.userId)).get();
  return me ?? null;
}

export async function POST(request: Request) {
  const me = await account(request);
  if (!me) return fail("Prijavi se da postaviš fotografiju.", 401);
  const bucket = env.BUCKET;
  if (!bucket) return fail("Skladište fotografija trenutno nije dostupno.", 503);
  const size = Number(request.headers.get("content-length"));
  if (size > maxBytes + 1024 * 1024) return fail("Fotografija može imati najviše 5 MB.", 413);
  try {
    const form = await request.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (kind !== "avatar" && kind !== "vehicle") return fail("Nepoznata vrsta fotografije.");
    if (me.role !== "driver") return fail("Fotografije profila vozača mogu postavljati samo vozači.", 403);
    if (!(file instanceof File) || file.size < 1 || file.size > maxBytes) return fail("Izaberi fotografiju do 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type) return fail("Dozvoljene su JPG, PNG i WebP fotografije.");
    const db = getDb();
    let position = -1;
    if (kind === "vehicle") {
      const existing = await db.select({ position: vehiclePhotos.position }).from(vehiclePhotos).where(eq(vehiclePhotos.driverId, me.id));
      position = [0,1,2,3].find(n => !existing.some(photo => photo.position === n)) ?? -1;
      if (position < 0) return fail("Možeš postaviti najviše četiri slike vozila.", 409);
    }
    const id = crypto.randomUUID();
    const key = `users/${me.id}/${kind}/${id}.${type.ext}`;
    await bucket.put(key, bytes, { httpMetadata: { contentType: type.mime } });
    try {
      if (kind === "avatar") {
        await db.update(users).set({ avatarKey: key, updatedAt: new Date().toISOString() }).where(eq(users.id, me.id));
        if (me.avatarKey) await bucket.delete(me.avatarKey).catch(() => {});
      } else {
        const saved = await db.insert(vehiclePhotos).values({ id, driverId: me.id, objectKey: key, position }).onConflictDoNothing().returning({ id: vehiclePhotos.id });
        if (!saved.length) { await bucket.delete(key); return fail("Fotografije su upravo izmenjene. Pokušaj ponovo.", 409); }
      }
    } catch (error) { await bucket.delete(key).catch(() => {}); throw error; }
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error("media upload error", error);
    return fail("Fotografija nije sačuvana. Pokušaj ponovo.", 500);
  }
}

export async function DELETE(request: Request) {
  const me = await account(request);
  if (!me) return fail("Prijavi se da ukloniš fotografiju.", 401);
  if (me.role !== "driver") return fail("Ova opcija je za vozače.", 403);
  const bucket = env.BUCKET;
  if (!bucket) return fail("Skladište fotografija trenutno nije dostupno.", 503);
  try {
    const input = await request.json() as { kind?: string; id?: string };
    const db = getDb();
    if (input.kind === "avatar") {
      if (!me.avatarKey) return fail("Nema profilne fotografije.", 404);
      await db.update(users).set({ avatarKey: null, updatedAt: new Date().toISOString() }).where(eq(users.id, me.id));
      await bucket.delete(me.avatarKey).catch(() => {});
      return Response.json({ ok: true });
    }
    if (input.kind === "vehicle" && typeof input.id === "string") {
      const photo = await db.select().from(vehiclePhotos).where(and(eq(vehiclePhotos.id, input.id), eq(vehiclePhotos.driverId, me.id))).get();
      if (!photo) return fail("Fotografija nije pronađena.", 404);
      await db.delete(vehiclePhotos).where(and(eq(vehiclePhotos.id, photo.id), eq(vehiclePhotos.driverId, me.id)));
      await bucket.delete(photo.objectKey).catch(() => {});
      return Response.json({ ok: true });
    }
    return fail("Nepoznata fotografija.");
  } catch (error) {
    console.error("media delete error", error);
    return fail("Fotografija nije uklonjena. Pokušaj ponovo.", 500);
  }
}
