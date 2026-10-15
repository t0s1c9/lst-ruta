import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clearSessionCookie, localSessions, sameOrigin, sessionTokenHash } from "../../../local-auth";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Zahtev nije sa ove stranice." }, { status: 403 });
  const tokenHash = await sessionTokenHash();
  if (tokenHash) await getDb().delete(localSessions).where(eq(localSessions.tokenHash, tokenHash));
  return clearSessionCookie(Response.json({ next: "/" }));
}
