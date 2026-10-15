"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, House, Truck } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "../brand-logo";

type Role = "company" | "driver" | "private";

export function RegisterForm({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    const companyName = String(data.get("companyName") || "");
    const password = String(data.get("password") || "");
    if (password !== String(data.get("confirmPassword") || "")) { setError("Lozinke se ne poklapaju."); setPending(false); return; }
    const payload = {
      type: "onboard", role, username: String(data.get("username") || ""),
      name: role === "company" ? companyName : String(data.get("name") || ""),
      companyName, homeCity: String(data.get("homeCity") || ""),
      vehicleKind: String(data.get("vehicleKind") || "Kombi"), phone: String(data.get("phone") || ""),
    };
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, email: data.get("email"), password }) });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error || "Registracija nije uspela.");
      window.location.assign("/app");
    } catch (e) { setError(e instanceof Error ? e.message : "Pokušaj ponovo."); setPending(false); }
  }

  return <div className="register-page">
    <header className="register-top"><BrandLogo/><Link href="/" className="back-link"><ArrowLeft size={15}/> Nazad</Link></header>
    <main className="register-wrap">
      <div className="register-intro"><span className="eyebrow">KORAK 1 OD 1</span><h1>Postavi svoj nalog.</h1><p>Izaberi ulogu i podatke koje će drugi videti uz tvoj oglas.</p></div>
      <form onSubmit={submit} className="register-panel">
        <div className="role-toggle">
          <button type="button" className={role === "company" ? "chosen" : ""} onClick={() => setRole("company")}><Building2 size={20}/> Firma</button>
          <button type="button" className={role === "driver" ? "chosen" : ""} onClick={() => setRole("driver")}><Truck size={20}/> Vozač</button>
          <button type="button" className={role === "private" ? "chosen" : ""} onClick={() => setRole("private")}><House size={20}/> Privatno lice</button>
        </div>
        <div className="form-grid">
          {role === "company" ? <label key="company-name">Naziv firme<input name="companyName" required minLength={2} maxLength={120} placeholder="Naziv firme"/></label> : <label key="person-name">Ime i prezime<input name="name" required minLength={2} maxLength={120} placeholder="Ime i prezime"/></label>}
          <label>Korisničko ime<input name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoComplete="username" placeholder="npr. ognjen_prevoz"/><small>3–24 slova, broja ili donje crte. Prikazuje se kao @ime.</small></label>
          <label>Email adresa<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="ime@primer.com"/><small>Koristi se za prijavu. Kod na email se ne šalje.</small></label><label>Lozinka<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Najmanje 12 znakova"/></label><label>Ponovi lozinku<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
          {role === "driver" && <><label>Grad iz kog krećeš<input name="homeCity" required minLength={2} placeholder="npr. Beograd"/></label><label>Tip vozila<select name="vehicleKind"><option>Kombi</option><option>Kamion</option><option>Šleper</option></select></label></>}
          {role === "private" && <label>Mesto (opciono)<input name="homeCity" placeholder="npr. Beograd"/></label>}
          <label>Telefon za kontakt (opciono)<input name="phone" type="tel" maxLength={30} placeholder="+381 ..."/></label>
        </div>
        {role === "private" && <p className="form-footnote">Možeš da objaviš potrebu za prevozom bez firme i vozila.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-red register-submit" disabled={pending}>{pending ? "Čuvanje..." : "Kreiraj nalog"}<ArrowRight size={17}/></button>
        <p className="form-footnote">Ulogu kasnije nije moguće promeniti na istom nalogu. Sačuvaj lozinku; automatski reset još nije dostupan. Već imaš nalog? <a href="/login">Prijavi se</a>.</p>
      </form>
    </main>
  </div>;
}
