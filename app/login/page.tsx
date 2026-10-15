import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { getCurrentUser } from "../local-auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const identity = await getCurrentUser();
  if (identity) {
    const user = await getDb().select({ id: users.id }).from(users).where(eq(users.id, identity.userId)).get();
    if (user) redirect("/app");
  }
  return <LoginForm/>;
}
