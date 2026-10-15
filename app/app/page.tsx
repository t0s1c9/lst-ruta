import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { requireCurrentUser } from "../local-auth";
import { Dashboard } from "./dashboard";

export const dynamic = "force-dynamic";
export default async function AppPage() {
  const identity = await requireCurrentUser("/app");
  const me = await getDb().select({ id: users.id }).from(users).where(eq(users.id, identity.userId)).get();
  if (!me) redirect("/register");
  return <Dashboard/>;
}
