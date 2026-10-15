"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { BrandLogo } from "../brand-logo";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: fields.get("identifier"), password: fields.get("password") }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Prijava nije uspela.");
      window.location.assign("/app");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pokušaj ponovo."); setPending(false); }
  }
  return <div className="register-page"><header className="register-top"><BrandLogo/><Link href="/" className="back-link"><ArrowLeft size={15}/> Nazad</Link></header>
    <main className="auth-wrap"><div className="auth-intro"><span className="eyebrow">LST RUTA</span><h1>Dobro došao nazad<span className="heading-period">.</span></h1><p>Prijavi se i nastavi tamo gde si stao. Ture, oglasi i poruke čekaju te u aplikaciji.</p></div>
      <form className="register-panel auth-panel" onSubmit={submit}><div className="auth-symbol"><LockKeyhole size={22}/></div><h2>Prijava na nalog</h2><div className="form-grid"><label>Email ili korisničko ime<input name="identifier" required autoComplete="username" placeholder="tvoje_ime ili email"/></label><label>Lozinka<input name="password" type="password" required autoComplete="current-password" placeholder="Tvoja lozinka"/></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-red register-submit" disabled={pending}>{pending ? "Prijavljivanje..." : "Prijavi se"} <ArrowRight size={17}/></button><p className="form-footnote">Nemaš nalog? <Link href="/register">Registruj se</Link></p></form>
    </main></div>;
}
