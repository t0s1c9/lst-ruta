import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { attemptKey, createSession, getCurrentUser, hashPassword, isRateLimited, localSessions, noteAttempt, passwordAccounts, sameOrigin, sessionRecord, setSessionCookie } from "../../../local-auth";

export const dynamic = "force-dynamic";
const inputSchema = z.object({
  role: z.enum(["company", "driver", "private"]),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  name: z.string().trim().min(2).max(120),
  companyName: z.string().trim().max(120).default(""),
  homeCity: z.string().trim().max(100).default(""),
  vehicleKind: z.enum(["Kombi", "Kamion", "Šleper"]).default("Kombi"),
  phone: z.string().trim().max(30).default(""),
});
const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Zahtev nije sa ove stranice.", 403);
  if (await getCurrentUser()) return fail("Već si prijavljen. Odjavi se pre otvaranja novog naloga.", 409);
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("Neispravni podaci."); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return fail("Proveri podatke. Lozinka mora imati najmanje 12 znakova.");
  const input = parsed.data;
  if (input.role === "company" && input.companyName.length < 2) return fail("Unesi naziv firme.");
  if (input.role === "driver" && input.homeCity.length < 2) return fail("Unesi polazni grad.");
  const key = await attemptKey(request, "register", "new-account");
  if (await isRateLimited(key, 10)) return fail("Previše registracija. Pokušaj ponovo kasnije.", 429);
  try {
    await noteAttempt(key, 60);
    const db = getDb();
    if (await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email}`).get()) {
      return fail("Za ovu adresu već postoji nalog. Prijavi se postojećom lozinkom.", 409);
    }
    if (await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).get()) return fail("Korisničko ime je zauzeto.", 409);
    const id = crypto.randomUUID();
    const password = await hashPassword(input.password);
    const session = createSession();
    const record = await sessionRecord(id, session);
    await db.batch([
      db.insert(users).values({ id, email: input.email, username: input.username, name: input.role === "company" ? input.companyName : input.name, role: input.role, companyName: input.role === "company" ? input.companyName : null, homeCity: input.homeCity || null, vehicleKind: input.role === "driver" ? input.vehicleKind : null, phone: input.phone || null }),
      db.insert(passwordAccounts).values({ userId: id, email: input.email, ...password }),
      db.insert(localSessions).values(record),
    ]);
    return setSessionCookie(Response.json({ ok: true }, { status: 201 }), session.token);
  } catch (error) {
    if (String(error).includes("UNIQUE") || String(error).includes("unique")) return fail("Email ili korisničko ime je zauzeto.", 409);
    console.error("local register error", error);
    return fail("Registracija nije uspela. Pokušaj ponovo.", 500);
  }
}
