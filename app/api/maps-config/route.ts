import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../local-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getCurrentUser();
  if (!identity) return Response.json({ error: "Prijavi se da nastaviš." }, { status: 401 });
  const key = typeof env.GOOGLE_MAPS_EMBED_KEY === "string" && env.GOOGLE_MAPS_EMBED_KEY.trim()
    ? env.GOOGLE_MAPS_EMBED_KEY.trim()
    : null;
  return Response.json({ key }, { headers: { "Cache-Control": "private, no-store" } });
}
