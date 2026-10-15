import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { users } from "../db/schema";
import { getCurrentUser } from "./local-auth";
import { Landing } from "./landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getCurrentUser();
  if (identity) {
    const me = await getDb().select({ id: users.id }).from(users).where(eq(users.id, identity.userId)).get();
    if (me) redirect("/app");
  }
  return <Landing
    signedIn={!!identity}
    companyHref="/register?role=company"
    driverHref="/register?role=driver"
    privateHref="/register?role=private"
  />;
}
