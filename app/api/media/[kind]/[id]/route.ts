import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { users, vehiclePhotos } from "../../../../../db/schema";
import { getCurrentUser } from "../../../../local-auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  const identity = await getCurrentUser();
  if (!identity) return new Response("Prijava je obavezna.", { status: 401 });
  const db = getDb();
  if (!await db.select({ id: users.id }).from(users).where(eq(users.id, identity.userId)).get()) return new Response("Nalog nije pronađen.", { status: 403 });
  const { kind, id } = await context.params;
  let key: string | null = null;
  if (kind === "avatar") {
    key = (await db.select({ key: users.avatarKey }).from(users).where(eq(users.id, id)).get())?.key ?? null;
  } else if (kind === "vehicle") {
    key = (await db.select({ key: vehiclePhotos.objectKey }).from(vehiclePhotos).where(eq(vehiclePhotos.id, id)).get())?.key ?? null;
  }
  if (!key) return new Response("Fotografija nije pronađena.", { status: 404 });
  const bucket = env.BUCKET;
  if (!bucket) return new Response("Skladište trenutno nije dostupno.", { status: 503 });
  const object = await bucket.get(key);
  if (!object) return new Response("Fotografija nije pronađena.", { status: 404 });
  const mime = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(object.body, { headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
