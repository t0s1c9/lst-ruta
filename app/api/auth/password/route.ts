import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { attemptKey, clearAttempts, createSession, getCurrentUser, hashPassword, isRateLimited, localSessions, noteAttempt, passwordAccounts, sameOrigin, sessionRecord, setSessionCookie, verifyPassword } from "../../../local-auth";

export const dynamic = "force-dynamic";
const schema = z.object({ password: z.string().min(12).max(128), currentPassword: z.string().max(128).optional() });
const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Zahtev nije sa ove stranice.", 403);
  const identity = await getCurrentUser();
  if (!identity) return fail("Prijavi se da postaviš lozinku.", 401);
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("Neispravan zahtev."); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail("Nova lozinka mora imati najmanje 12 znakova.");
  const key = await attemptKey(request, "password", identity.userId);
  if (await isRateLimited(key, 6)) return fail("Previše pokušaja. Sačekaj 15 minuta.", 429);
  try {
    const db = getDb();
    const me = await db.select().from(users).where(eq(users.id, identity.userId)).get();
    if (!me) return fail("Nalog nije pronađen.", 404);
    const existing = await db.select().from(passwordAccounts).where(eq(passwordAccounts.userId, me.id)).get();
    if (existing && identity.source === "local" && !await verifyPassword(parsed.data.currentPassword || "", existing)) {
      await noteAttempt(key, 15);
      return fail("Trenutna lozinka nije tačna.", 403);
    }
    const password = await hashPassword(parsed.data.password);
    const session = createSession();
    const record = await sessionRecord(me.id, session);
    await db.batch([
      db.insert(passwordAccounts).values({ userId: me.id, email: me.email.trim().toLowerCase(), ...password })
        .onConflictDoUpdate({ target: passwordAccounts.userId, set: { ...password, updatedAt: new Date().toISOString() } }),
      db.delete(localSessions).where(eq(localSessions.userId, me.id)),
      db.insert(localSessions).values(record),
    ]);
    await clearAttempts(key);
    return setSessionCookie(Response.json({ ok: true }), session.token);
  } catch (error) {
    if (String(error).includes("UNIQUE") || String(error).includes("unique")) return fail("Ovaj email već koristi drugi nalog. Obrati se podršci.", 409);
    console.error("password update error", error);
    return fail("Lozinka nije sačuvana. Pokušaj ponovo.", 500);
  }
}
