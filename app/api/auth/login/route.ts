import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { attemptKey, clearAttempts, createSession, isRateLimited, localSessions, noteAttempt, passwordAccounts, sameOrigin, sessionRecord, setSessionCookie, verifyPassword } from "../../../local-auth";

export const dynamic = "force-dynamic";
const schema = z.object({ identifier: z.string().trim().toLowerCase().min(3).max(254), password: z.string().min(1).max(128) });
const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Zahtev nije sa ove stranice.", 403);
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("Neispravan zahtev."); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail("Unesi email ili korisničko ime i lozinku.");
  const { identifier, password } = parsed.data;
  const key = await attemptKey(request, "login", identifier);
  const globalKey = await attemptKey(request, "login", "all-identifiers");
  if (await isRateLimited(key, 6) || await isRateLimited(globalKey, 30)) return fail("Previše pokušaja. Sačekaj 15 minuta.", 429);
  try {
    await noteAttempt(globalKey, 15);
    const db = getDb();
    const account = await db.select({ userId: passwordAccounts.userId, salt: passwordAccounts.salt, passwordHash: passwordAccounts.passwordHash, iterations: passwordAccounts.iterations })
      .from(passwordAccounts).innerJoin(users, eq(users.id, passwordAccounts.userId))
      .where(or(eq(passwordAccounts.email, identifier), eq(users.username, identifier))).get();
    if (!await verifyPassword(password, account)) {
      await noteAttempt(key, 15);
      return fail("Pogrešno korisničko ime/email ili lozinka.", 401);
    }
    await clearAttempts(key);
    const session = createSession();
    await db.insert(localSessions).values(await sessionRecord(account!.userId, session));
    return setSessionCookie(Response.json({ ok: true }), session.token);
  } catch (error) {
    console.error("local login error", error);
    return fail("Prijava trenutno nije dostupna. Pokušaj ponovo.", 500);
  }
}
