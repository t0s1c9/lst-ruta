import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { authAttempts, localSessions, passwordAccounts, users } from "../db/schema";
export { hashPassword, verifyPassword } from "./password-crypto";

const cookieName = "__Host-lst_session";
const sessionSeconds = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();

export type CurrentUser = { userId: string; email: string; displayName: string; fullName: string | null; source: "local" };

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function digest(value: string): Promise<string> {
  return encode(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

export async function sessionTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return digest(token);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const tokenHash = await sessionTokenHash();
  if (tokenHash) {
    const db = getDb();
    const session = await db.select({ id: users.id, email: users.email, name: users.name })
      .from(localSessions).innerJoin(users, eq(localSessions.userId, users.id))
      .where(and(eq(localSessions.tokenHash, tokenHash), gt(localSessions.expiresAt, new Date().toISOString()))).get();
    if (session) return { userId: session.id, email: session.email, displayName: session.name, fullName: session.name, source: "local" };
  }
  return null;
}

export async function requireCurrentUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const safePath = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/app";
  redirect("/login?next=" + encodeURIComponent(safePath));
}

export function createSession() {
  const token = encode(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + sessionSeconds * 1000).toISOString();
  return { token, expiresAt };
}

export async function sessionRecord(userId: string, session: ReturnType<typeof createSession>) {
  return { userId, tokenHash: await digest(session.token), expiresAt: session.expiresAt };
}

export function setSessionCookie(response: Response, token: string) {
  response.headers.append("Set-Cookie", cookieName + "=" + token + "; Path=/; Max-Age=" + sessionSeconds + "; Secure; HttpOnly; SameSite=Lax");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function clearSessionCookie(response: Response) {
  response.headers.append("Set-Cookie", cookieName + "=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export async function attemptKey(request: Request, operation: string, identifier: string) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return digest(operation + ":" + identifier.toLowerCase() + ":" + ip);
}

export async function isRateLimited(key: string, limit: number) {
  const row = await getDb().select().from(authAttempts).where(eq(authAttempts.key, key)).get();
  return !!row && row.resetAt > new Date().toISOString() && row.count >= limit;
}

export async function noteAttempt(key: string, minutes: number) {
  const current = new Date().toISOString();
  const resetAt = new Date(Date.now() + minutes * 60_000).toISOString();
  await getDb().insert(authAttempts).values({ key, count: 1, resetAt })
    .onConflictDoUpdate({ target: authAttempts.key, set: {
      count: sql`case when ${authAttempts.resetAt} <= ${current} then 1 else ${authAttempts.count} + 1 end`,
      resetAt: sql`case when ${authAttempts.resetAt} <= ${current} then ${resetAt} else ${authAttempts.resetAt} end`,
    } });
}

export async function clearAttempts(key: string) {
  await getDb().delete(authAttempts).where(eq(authAttempts.key, key));
}

export { passwordAccounts, localSessions };
