import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { getCurrentUser } from "../local-auth";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  const role = params.role === "driver" || params.role === "private" ? params.role : "company";
  const identity = await getCurrentUser();
  if (identity) {
    const existing = await getDb().select({ id: users.id }).from(users).where(eq(users.id, identity.userId)).get();
    if (existing) redirect("/app");
  }
  return <RegisterForm initialRole={role}/>;
}
