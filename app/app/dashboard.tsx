"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InstallButton } from "../pwa-install";
import { BrandLogo } from "../brand-logo";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays,
  Check, CircleHelp, Compass, Download, ExternalLink, LayoutDashboard,
  House, LogOut, MapPin, Menu, MessageCircle, PackageCheck, Plus, RefreshCw, Route,
  Search, Send, Settings2, ShieldCheck, SlidersHorizontal, TrendingUp, Truck, Users,
  Wallet, X, Star, Camera, ImagePlus, Trash2,
} from "lucide-react";

type Role = "company" | "driver" | "private";
type Status = "open" | "accepted" | "loading" | "in_transit" | "delivered" | "cancelled";
type User = { id: string; email: string; username: string | null; name: string; role: Role; companyName: string | null; phone: string | null; homeCity: string | null; vehicleKind: string | null; vehicleModel: string | null; bio: string | null; updatedAt: string };
type Person = Pick<User, "id" | "name" | "role" | "companyName" | "homeCity" | "vehicleKind" | "vehicleModel" | "bio" | "username" | "updatedAt"> & { hasAvatar: boolean; ratingAverage: number; ratingCount: number };
type VehiclePhoto = { id: string; driverId: string; position: number };
type ReviewNote = { subjectId: string; score: number; comment: string; createdAt: string };
type Tour = { id: string; companyId: string; driverId: string | null; pickupCity: string; pickupAddress: string; pickupNotes: string; pickupMapUrl: string | null; dropoffCity: string; dropoffAddress: string; cargoDescription: string; cargoWeight: number; vehicleKind: string; price: number; departureAt: string; status: Status; createdAt: string };
type Offer = { id: string; driverId: string; adType: "route" | "general"; serviceArea: string; description: string; originCity: string; destinationCity: string; vehicleKind: string; totalCapacity: number; freeCapacity: number; availableCapacity: number; alreadyLoaded: boolean; currentCargo: string; availableAt: string; active: boolean; updatedAt: string };
type Message = { id: string; tourId: string; senderId: string; recipientId: string; body: string; readAt: string | null; createdAt: string };
type AppState = { me: User; tours: Tour[]; offers: Offer[]; messages: Message[]; people: Person[]; vehiclePhotos: VehiclePhoto[]; myReviews: { tourId: string; score: number; comment: string; subjectId: string }[]; recentReviews: ReviewNote[]; auth: { hasPassword: boolean; source: "local" } };
type Section = "overview" | "tours" | "drivers" | "myrides" | "offer" | "messages" | "analytics" | "settings";
const statuses: Record<Status, string> = { open: "Otvorena", accepted: "Prihvaćena", loading: "Na utovaru", in_transit: "U transportu", delivered: "Isporučena", cancelled: "Otkazana" };
type TourFilters = { pickup: string; dropoff: string; vehicle: string; minWeight: string; maxWeight: string; minPrice: string; maxPrice: string; dateFrom: string; dateTo: string; requesterType: string; sort: string; fitsVehicle: boolean };
const emptyTourFilters: TourFilters = { pickup: "", dropoff: "", vehicle: "all", minWeight: "", maxWeight: "", minPrice: "", maxPrice: "", dateFrom: "", dateTo: "", requesterType: "all", sort: "newest", fitsVehicle: false };
const includes = (source: string, value: string) => source.toLocaleLowerCase("sr").includes(value.trim().toLocaleLowerCase("sr"));
const numberAtLeast = (value: number, minimum: string) => minimum === "" || value >= Number(minimum);
const numberAtMost = (value: number, maximum: string) => maximum === "" || value <= Number(maximum);
const withinDates = (value: string, start: string, end: string) => (!start || new Date(value).getTime() >= new Date(`${start}T00:00:00`).getTime()) && (!end || new Date(value).getTime() <= new Date(`${end}T23:59:59`).getTime());
const nextLabels: Partial<Record<Status, string>> = { accepted: "Stigao na utovar", loading: "Krenuo na put", in_transit: "Potvrdi isporuku" };
const money = (n: number) => n === 0 ? "Cena po dogovoru" : new Intl.NumberFormat("sr-RS").format(n) + " RSD";
const date = (s: string) => new Intl.DateTimeFormat("sr-RS", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
const localDateTime = (s?: string) => {
  const d = s ? new Date(s) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const mapUrl = (t: Tour) => t.pickupMapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.pickupAddress}, ${t.pickupCity}`)}`;
const mapAddress = (address: string, city: string) => `${address}, ${city}, Srbija`;
const mapEmbedUrl = (t: Tour, stop: "pickup" | "dropoff" | "route", key: string) => {
  const pickup = mapAddress(t.pickupAddress, t.pickupCity);
  const dropoff = mapAddress(t.dropoffAddress, t.dropoffCity);
  return stop === "route"
    ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}&language=sr`
    : `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(stop === "pickup" ? pickup : dropoff)}&language=sr`;
};
const directionsUrl = (t: Tour, stop: "pickup" | "dropoff" | "route") => {
  const pickup = mapAddress(t.pickupAddress, t.pickupCity);
  const dropoff = mapAddress(t.dropoffAddress, t.dropoffCity);
  const params = new URLSearchParams({ api: "1", travelmode: "driving" });
  if (stop === "route") { params.set("origin", pickup); params.set("destination", dropoff); }
  else params.set("destination", stop === "pickup" ? pickup : dropoff);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};
const vehiclePhotoUrl = (id: string) => `/api/media/vehicle/${encodeURIComponent(id)}`;

export function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<AppState | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tourFilters, setTourFilters] = useState<TourFilters>(emptyTourFilters);
  const [showTourFilters, setShowTourFilters] = useState(false);
  const [compose, setCompose] = useState(false);
  const [prefillOffer, setPrefillOffer] = useState<Offer | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [acceptingTourId, setAcceptingTourId] = useState<string | null>(null);
  const [mapTourId, setMapTourId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const reload = useCallback(async (quiet = false) => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const body = await res.json() as { error?: string; needsRegistration?: boolean } & Partial<AppState>;
      if (res.status === 401) { router.push("/"); return; }
      if (res.status === 409 && body.needsRegistration) { router.push("/register"); return; }
      if (!res.ok) throw new Error(body.error || "Podaci nisu dostupni.");
      setData(body as AppState);
      if (!quiet) setError("");
    } catch (e) { if (!quiet) setError(e instanceof Error ? e.message : "Pokušaj ponovo."); }
    finally { if (!quiet) setLoading(false); }
  }, [router]);
  useEffect(() => { const first = window.setTimeout(() => void reload(), 0); const timer = window.setInterval(() => void reload(true), 20000); return () => { clearTimeout(first); clearInterval(timer); }; }, [reload]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 4500); return () => clearTimeout(timer); }, [notice]);

  async function act(payload: Record<string, unknown>, success: string) {
    setPending(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error || "Radnja nije uspela.");
      await reload(true); setNotice(success);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Pokušaj ponovo."); return false; }
    finally { setPending(false); }
  }
  async function uploadPhoto(kind: "avatar" | "vehicle", file: File) {
    setPending(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.set("kind", kind); form.set("file", file);
      const res = await fetch("/api/media", { method: "POST", body: form });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error || "Fotografija nije sačuvana.");
      await reload(true); setNotice(kind === "avatar" ? "Profilna slika je sačuvana." : "Slika vozila je dodata.");
    } catch (e) { setError(e instanceof Error ? e.message : "Pokušaj ponovo."); }
    finally { setPending(false); }
  }
  async function removePhoto(kind: "avatar" | "vehicle", id?: string) {
    setPending(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error || "Fotografija nije uklonjena.");
      await reload(true); setNotice("Fotografija je uklonjena.");
    } catch (e) { setError(e instanceof Error ? e.message : "Pokušaj ponovo."); }
    finally { setPending(false); }
  }
  async function signOut() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Odjava nije uspela.");
      const body = await response.json() as { next: string };
      window.location.assign(body.next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pokušaj ponovo."); }
  }
  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get("password") || "");
    if (password !== fields.get("confirmation")) { setError("Lozinke se ne poklapaju."); return; }
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, currentPassword: fields.get("currentPassword") || "" }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Lozinka nije sačuvana.");
      form.reset();
      await reload(true);
      setNotice("Lozinka je sačuvana.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pokušaj ponovo."); }
    finally { setPending(false); }
  }
  function go(to: Section) { setSection(to); setSearch(""); setStatusFilter("all"); setTourFilters(emptyTourFilters); setShowTourFilters(false); setError(""); setMenuOpen(false); setAcceptingTourId(null); setMapTourId(null); }
  function resetTourSearch() { setSearch(""); setStatusFilter("all"); setTourFilters(emptyTourFilters); }
  async function acceptTour(tourId: string, payload: Record<string, unknown>) {
    const ok = await act(payload, "Prihvatio si turu. Lokacije su otvorene u Mojim vožnjama.");
    if (ok) { go("myrides"); setMapTourId(tourId); }
    return ok;
  }
  function newTour(offer?: Offer) { go("tours"); setPrefillOffer(offer ?? null); setCompose(true); }
  async function openChat(id: string) { setChatId(id); go("messages"); if (data?.messages.some(m => m.tourId === id && m.recipientId === data.me.id && !m.readAt)) await act({ type: "message.read", tourId: id }, ""); }

  const me = data?.me;
  const company = me?.role === "company";
  const privateUser = me?.role === "private";
  const requester = company || privateUser;
  const driverRole = me?.role === "driver";
  const myOffer = data?.offers.find(o => o.driverId === me?.id);
  const assigned = data?.tours.filter(t => t.driverId === me?.id) || [];
  const active = requester ? data?.tours.filter(t => !["delivered", "cancelled"].includes(t.status)).length || 0 : assigned.filter(t => !["delivered", "cancelled"].includes(t.status)).length;
  const unread = data?.messages.filter(m => m.recipientId === me?.id && !m.readAt).length || 0;
  const person = (id: string | null) => data?.people.find(p => p.id === id);
  const nav: { id: Section; label: string; icon: typeof LayoutDashboard; count?: number }[] = requester ? [
    { id: "overview", label: "Pregled", icon: LayoutDashboard }, { id: "tours", label: company ? "Moje ture" : "Moji zahtevi", icon: Route, count: active },
    { id: "drivers", label: "Oglasi vozača", icon: Users, count: data?.offers.length }, { id: "messages", label: "Poruke", icon: MessageCircle, count: unread },
    ...(company ? [{ id: "analytics" as const, label: "Analitika", icon: TrendingUp }] : []), { id: "settings", label: "Podešavanja", icon: Settings2 },
  ] : [
    { id: "overview", label: "Pregled", icon: LayoutDashboard }, { id: "tours", label: "Pronađi turu", icon: Compass },
    { id: "myrides", label: "Moje vožnje", icon: Route, count: active }, { id: "offer", label: "Moj oglas", icon: Truck },
    { id: "messages", label: "Poruke", icon: MessageCircle, count: unread }, { id: "settings", label: "Moj profil", icon: Settings2 },
  ];
  const titles: Record<Section, [string, string]> = {
    overview: [company ? "Kontrolna tabla" : privateUser ? "Tvoj prevoz" : "Tvoj radni prostor", company ? "Sve ture i vozači, na jednom mestu." : privateUser ? "Objavi šta treba prevesti i pronađi vozača." : "Pronađi sledeću vožnju i prati svoje ture."],
    tours: [company ? "Moje ture" : privateUser ? "Moji zahtevi" : "Pronađi turu", requester ? "Objavi prevoz sa tačnom adresom preuzimanja." : "Aktuelne ture koje čekaju vozača."],
    drivers: ["Oglasi vozača", "Pronađi prevoz po relaciji ili usluzi, vozilu i slobodnom prostoru."],
    myrides: ["Moje vožnje", "Statusi tura koje si prihvatio."],
    offer: ["Moj oglas", "Ponudi prevoz na određenoj relaciji ili objavi opštu uslugu prevoza."],
    messages: ["Poruke", "Razgovori povezani sa prihvaćenim turama."],
    analytics: ["Analitika", "Učinak tvojih objavljenih tura."],
    settings: [requester ? "Podešavanja" : "Moj profil", "Podaci kojima se predstavljaš na platformi."],
  };
  const activeTourFilters = Object.entries(tourFilters).filter(([key, value]) => value !== "" && value !== "all" && value !== false && !(key === "sort" && value === "newest")).length + (statusFilter !== "all" ? 1 : 0) + (search.trim() ? 1 : 0);
  const filtered = (() => {
    const pool = section === "myrides" ? assigned : (requester ? data?.tours || [] : (data?.tours || []).filter(t => t.status === "open"));
    return pool.filter(t => {
      const owner = person(t.companyId);
      return includes(`${t.pickupCity} ${t.pickupAddress} ${t.dropoffCity} ${t.dropoffAddress} ${t.cargoDescription} ${owner?.companyName || ""} ${owner?.name || ""} ${owner?.username || ""}`, search)
        && (statusFilter === "all" || t.status === statusFilter)
        && includes(`${t.pickupCity} ${t.pickupAddress}`, tourFilters.pickup)
        && includes(`${t.dropoffCity} ${t.dropoffAddress}`, tourFilters.dropoff)
        && (tourFilters.vehicle === "all" || t.vehicleKind === tourFilters.vehicle)
        && numberAtLeast(t.cargoWeight, tourFilters.minWeight) && numberAtMost(t.cargoWeight, tourFilters.maxWeight)
        && numberAtLeast(t.price, tourFilters.minPrice) && numberAtMost(t.price, tourFilters.maxPrice)
        && withinDates(t.departureAt, tourFilters.dateFrom, tourFilters.dateTo)
        && (tourFilters.requesterType === "all" || owner?.role === tourFilters.requesterType)
        && (!tourFilters.fitsVehicle || ((t.vehicleKind === "Bilo koje" || (myOffer?.active ? myOffer.vehicleKind : me?.vehicleKind) === t.vehicleKind) && (!myOffer?.active || myOffer.availableCapacity >= t.cargoWeight)));
    }).sort((a, b) => {
      if (tourFilters.sort === "soonest") return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
      if (tourFilters.sort === "priceAsc") return a.price - b.price;
      if (tourFilters.sort === "priceDesc") return b.price - a.price;
      if (tourFilters.sort === "weightDesc") return b.cargoWeight - a.cargoWeight;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  })();

  function tourCard(t: Tour, compact = false) {
    const hasActiveOffer = !!myOffer?.active;
    const compatible = hasActiveOffer && (t.vehicleKind === "Bilo koje" || myOffer.vehicleKind === t.vehicleKind) && myOffer.availableCapacity >= t.cargoWeight;
    const reservedWeight = assigned.filter(ride => ["accepted", "loading", "in_transit"].includes(ride.status)).reduce((total, ride) => total + ride.cargoWeight, 0);
    const owner = person(t.companyId); const driver = person(t.driverId);
    return <article className={`tour-card ${compact ? "compact" : ""}`} key={t.id}>
      <div className="tour-top"><span className={`status status-${t.status}`}><span className="status-dot"/>{statuses[t.status]}</span><span className="tour-code">#{t.id.slice(0, 8).toUpperCase()}</span></div>
      <div className="route-line"><div><span className="route-marker origin"/><span className="route-city">{t.pickupCity}</span><small>UTOVAR</small></div><div className="route-track"/><div><span className="route-marker destination"/><span className="route-city">{t.dropoffCity}</span><small>ISTOVAR</small></div></div>
      {!compact && <div className="address-block"><div><MapPin size={17}/><div><small>TAČNA LOKACIJA PREUZIMANJA</small><strong>{t.pickupAddress}, {t.pickupCity}</strong>{t.pickupNotes && <span>{t.pickupNotes}</span>}<a href={mapUrl(t)} target="_blank" rel="noreferrer">Otvori na mapi <ExternalLink size={13}/></a></div></div><div><ArrowDownRight size={17}/><div><small>ADRESA ISTOVARA</small><strong>{t.dropoffAddress}, {t.dropoffCity}</strong></div></div></div>}
      <div className="tour-meta"><span><CalendarDays size={15}/>{date(t.departureAt)}</span><span><Truck size={15}/>{t.vehicleKind}</span><span><PackageCheck size={15}/>{t.cargoDescription} · {t.cargoWeight} t</span></div>
      <div className="tour-bottom"><div><strong>{money(t.price)}</strong><small>{requester ? (driver ? `Vozi ${driver.name}` : "Čeka vozača") : (owner?.companyName || owner?.name || "Naručilac")}</small>{driverRole && owner?.username && <small>@{owner.username}</small>}{requester && driver?.username && <small>@{driver.username}</small>}{driverRole && <RatingBadge person={owner}/>}</div><div className="tour-actions">
        {compact && <button className="text-button" onClick={() => go(requester || t.status === "open" ? "tours" : "myrides")}>Detalji <ArrowRight size={15}/></button>}
        {!compact && requester && t.status === "open" && <button className="btn btn-outline danger" disabled={pending} onClick={() => { if (window.confirm("Otkazati ovaj otvoreni zahtev?")) void act({ type: "tour.cancel", tourId: t.id }, "Zahtev je otkazan."); }}>Otkaži zahtev</button>}
        {!compact && driverRole && t.status === "open" && <button className="btn btn-red" disabled={pending || (hasActiveOffer && !compatible)} onClick={() => {
          if (compatible) void acceptTour(t.id, { type: "tour.accept", tourId: t.id });
          else { setError(""); setAcceptingTourId(t.id); }
        }}>{acceptingTourId === t.id ? "Potvrdi podatke" : "Prihvati turu"} <ArrowRight size={15}/></button>}
        {!compact && driverRole && t.status === "open" && hasActiveOffer && !compatible && <button className="text-button" onClick={() => go("offer")}>Podesi oglas</button>}
        {!compact && driverRole && !!nextLabels[t.status] && <button className="btn btn-red" disabled={pending} onClick={() => void act({ type: "tour.advance", tourId: t.id }, "Status ture je ažuriran.")}>{nextLabels[t.status]} <ArrowRight size={15}/></button>}
        {!compact && t.driverId && <button className="btn btn-outline" aria-expanded={mapTourId === t.id} onClick={() => setMapTourId(mapTourId === t.id ? null : t.id)}><MapPin size={15}/> {mapTourId === t.id ? "Zatvori lokacije" : "Lokacije ture"}</button>}
        {!compact && t.driverId && <button className="btn btn-outline" onClick={() => void openChat(t.id)}><MessageCircle size={15}/> Poruke</button>}
      </div></div>
      {!compact && driverRole && t.status === "open" && hasActiveOffer && !compatible && <p className="accept-warning">Aktivni oglas nema odgovarajuće vozilo ili dovoljno slobodnog prostora za ovu turu. Izmeni oglas pa pokušaj ponovo.</p>}
      {!compact && driverRole && t.status === "open" && !hasActiveOffer && acceptingTourId === t.id && <DirectAcceptForm key={t.id} tour={t} profileVehicle={me?.vehicleKind} reservedWeight={reservedWeight} pending={pending} error={error} onClose={() => setAcceptingTourId(null)} act={payload => acceptTour(t.id, payload)}/>}
      {!compact && t.driverId && mapTourId === t.id && <RouteMapPanel tour={t}/>}
      {!compact && requester && driver && <div className="tour-rating"><span>Ocena vozača</span><RatingBadge person={driver}/></div>}
      {!compact && <ReviewComments subjectId={requester ? driver?.id : owner?.id} reviews={data?.recentReviews || []}/>}
      {!compact && t.status === "delivered" && t.driverId && (t.companyId === me?.id || t.driverId === me?.id) && <RatingForm tourId={t.id} targetName={me?.id === t.companyId ? driver?.name || "vozača" : owner?.companyName || owner?.name || "naručioca"} previous={data?.myReviews.find(r => r.tourId === t.id)} pending={pending} act={act}/>}
    </article>;
  }

  function submitTour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const f = new FormData(form);
    const payload = { type: "tour.create", pickupCity: f.get("pickupCity"), pickupAddress: f.get("pickupAddress"), pickupNotes: f.get("pickupNotes"), pickupMapUrl: f.get("pickupMapUrl"), dropoffCity: f.get("dropoffCity"), dropoffAddress: f.get("dropoffAddress"), cargoDescription: f.get("cargoDescription"), cargoWeight: f.get("cargoWeight"), vehicleKind: f.get("vehicleKind"), price: f.get("price"), departureAt: new Date(String(f.get("departureAt"))).toISOString() };
    void act(payload, "Tura je objavljena.").then(ok => { if (ok) { setCompose(false); setPrefillOffer(null); form.reset(); } });
  }
  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    void act({ type: "profile", username: f.get("username"), name: f.get("name") || f.get("companyName"), companyName: f.get("companyName") || "", homeCity: f.get("homeCity") || "", vehicleKind: f.get("vehicleKind") || undefined, vehicleModel: f.get("vehicleModel") || "", bio: f.get("bio") || "", phone: f.get("phone") || "" }, "Profil je sačuvan.");
  }

  async function downloadData() {
    setExporting(true); setError("");
    try {
      const response = await fetch("/api/export", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error || "Podaci trenutno nisu dostupni.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lst-ruta-podaci-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice("Podaci naloga su preuzeti.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preuzimanje nije uspelo.");
    } finally {
      setExporting(false);
    }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
      <div className="sidebar-brand"><BrandLogo href="/app"/><button className="mobile-close" aria-label="Zatvori meni" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
      <div className="workspace-switch"><div className="workspace-icon">{company ? <Building2 size={19}/> : privateUser ? <House size={19}/> : <Truck size={20}/>}</div><div><strong>{company ? me?.companyName : me?.name || "Moj nalog"}</strong><span>{company ? "LOGISTIČKA FIRMA" : privateUser ? "PRIVATNO LICE" : "NALOG VOZAČA"}</span></div></div>
      <div className="sidebar-label">RADNI PROSTOR</div><nav aria-label="Glavna navigacija" className="side-nav">{nav.map(({ id, label, icon: Icon, count }) => <button key={id} className={section === id ? "active" : ""} onClick={() => go(id)}><Icon size={18} strokeWidth={1.85}/><span>{label}</span>{!!count && <em>{count}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-symbol"><CircleHelp size={18}/></div><strong>Treba ti pomoć?</strong><p>Svaka tura čuva adresu utovara, podatke i razgovor na jednom mestu.</p><button onClick={() => requester ? newTour() : go("offer")}>{company ? "Objavi prvu turu" : privateUser ? "Objavi zahtev" : "Postavi oglas"} <ArrowRight size={14}/></button></div><button type="button" className="signout" onClick={() => void signOut()}><LogOut size={17}/> Odjavi se</button></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim" aria-label="Zatvori meni" onClick={() => setMenuOpen(false)}/>}
    <div className="workspace">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" aria-label="Otvori meni" onClick={() => setMenuOpen(true)}><Menu size={23}/></button><span className="topbar-path">LST RUTA</span><span className="topbar-slash">/</span><strong>{titles[section][0]}</strong></div><div className="topbar-right"><span className="live-pill"><i/> AKTIVNO</span><InstallButton className="install-topbar" label="Instaliraj"/><button className="icon-button" aria-label="Osveži podatke" title="Osveži podatke" onClick={() => void reload()}><RefreshCw size={18}/></button><button className="icon-button notification" aria-label={`Poruke: ${unread} nepročitanih`} onClick={() => go("messages")}><Bell size={19}/>{unread > 0 && <b/>}</button><button className="avatar" title="Moj profil" onClick={() => go("settings")}><ProfileAvatar person={person(me?.id || null)} fallback={me?.name || "T"}/></button></div></header>
      <main className="content"><div className="page-heading"><div><div className="eyebrow"><span/> {company ? "ZA FIRME" : privateUser ? "ZA PRIVATNA LICA" : "ZA VOZAČE"} / {titles[section][0].toUpperCase()}</div><h1>{titles[section][0]}<span className="heading-period">.</span></h1><p>{titles[section][1]}</p></div>{requester && (section === "overview" || section === "tours" || section === "drivers") && <button className="btn btn-red heading-action" onClick={() => newTour()}><Plus size={17}/> {privateUser ? "Objavi zahtev" : "Objavi turu"}</button>}{driverRole && (section === "overview" || section === "tours") && <button className="btn btn-red heading-action" onClick={() => go("offer")}><Plus size={17}/> {myOffer?.active ? "Uredi oglas" : "Postavi oglas"}</button>}</div>
      {error && <div role="alert" className="alert error"><span>{error}</span><button aria-label="Zatvori obaveštenje" onClick={() => setError("")}><X size={17}/></button></div>}
      {notice && <div role="status" className="alert success"><Check size={17}/><span>{notice}</span><button aria-label="Zatvori obaveštenje" onClick={() => setNotice("")}><X size={17}/></button></div>}
      {loading && !data ? <div className="loading"><RefreshCw size={22} className="spin"/> Učitavanje podataka...</div> : !data ? <div className="empty"><strong>Podaci nisu učitani.</strong><button className="btn btn-red" onClick={() => void reload()}>Pokušaj ponovo</button></div> : <>
        {section === "overview" && <>
          <div className="hero-banner"><div className="hero-glow"/><div className="hero-copy"><span className="hero-kicker"><span/> {privateUser ? "PREVOZ ZA TEBE" : "TVOJ LOGISTIČKI CENTAR"}</span><h2>{company ? "Sve je spremno za" : privateUser ? "Treba ti prevoz" : "Tvoja sledeća tura"}<br/><em>{company ? "sledeću turu." : privateUser ? "za drva ili stvari?" : "počinje ovde."}</em></h2><p>{company ? "Objavi prevoz sa adresom, detaljima tereta i cenom. Vozači vide sve što im je potrebno." : privateUser ? "Napiši šta treba prevesti, odakle i dokle. Pregledaj vozače i objavi svoj zahtev bez firme." : "Pronađi turu koja ti odgovara, potvrdi vozilo i slobodan prostor, pa kreni."}</p><button className="btn btn-white" onClick={() => requester ? newTour() : go("tours")}>{company ? "Objavi novu turu" : privateUser ? "Objavi zahtev za prevoz" : "Pronađi turu"} <ArrowUpRight size={17}/></button></div><div className="hero-art" aria-hidden="true"><div className="hero-ring ring-one"/><div className="hero-ring ring-two"/><Truck size={110} strokeWidth={1}/><span className="hero-art-label">MOVE SMARTER <b>↗</b></span></div></div>
          <div className="stats-grid">{(requester ? [
            { label: privateUser ? "Moji zahtevi" : "Ukupno tura", value: data.tours.length, icon: Route, accent: true }, { label: privateUser ? "Aktivni zahtevi" : "Aktivne ture", value: active, icon: ArrowUpRight }, { label: "Dostupni vozači", value: data.offers.length, icon: Truck }, { label: "Isporučeno", value: data.tours.filter(t => t.status === "delivered").length, icon: PackageCheck },
          ] : [
            { label: "Dostupne ture", value: data.tours.filter(t => t.status === "open").length, icon: Route, accent: true }, { label: "Aktivne vožnje", value: active, icon: ArrowUpRight }, { label: "Isporučeno", value: assigned.filter(t => t.status === "delivered").length, icon: PackageCheck }, { label: "Javni oglas", value: myOffer?.active ? "Aktivan" : "Neaktivan", icon: Truck },
          ]).map(({ label, value, icon: Icon, accent }) => <div className={`stat-card ${accent ? "accent" : ""}`} key={label}><div className="stat-icon"><Icon size={19}/></div><strong>{value}</strong><span>{label}</span><ArrowUpRight size={16} className="stat-arrow"/></div>)}</div>
          <div className="section-header"><div><span className="eyebrow plain">U TOKU</span><h2>{requester ? privateUser ? "Moji zahtevi" : "Najnovije ture" : "Ture za tebe"}</h2></div><button className="text-button" onClick={() => go("tours")}>Pogledaj sve <ArrowRight size={16}/></button></div>
          {((requester ? data.tours : data.tours.filter(t => t.status === "open")).length > 0) ? <div className="card-grid">{(requester ? data.tours : data.tours.filter(t => t.status === "open")).slice(0, 2).map(t => tourCard(t, true))}</div> : <div className="empty"><Route size={30}/><strong>{requester ? privateUser ? "Još nema tvojih zahteva." : "Još nema objavljenih tura." : "Trenutno nema otvorenih tura."}</strong><p>{requester ? "Objavi prvi prevoz sa tačnom adresom preuzimanja." : "Proveri ponovo uskoro ili ostavi aktivan oglas."}</p><button className="btn btn-red" onClick={() => requester ? newTour() : go("offer")}>{privateUser ? "Objavi zahtev" : company ? "Objavi turu" : "Postavi oglas"}</button></div>}
          {requester && <section className="driver-preview"><div className="section-header"><div><span className="eyebrow plain">VOZAČI NA PUTU</span><h2>Oglasi vozača</h2></div><button className="text-button" onClick={() => go("drivers")}>Pogledaj sve <ArrowRight size={16}/></button></div>{data.offers.length ? <div className="card-grid">{data.offers.slice(0,2).map(o => <DriverAdCard key={o.id} offer={o} driver={person(o.driverId)} reviews={data.recentReviews} photos={data.vehiclePhotos.filter(p => p.driverId === o.driverId)} onCreate={() => newTour(o)} privateUser={privateUser}/>)}</div> : <div className="empty"><Users size={29}/><strong>Vozači još nisu postavili oglase.</strong><p>Njihove ponude će se pojaviti ovde čim ih objave.</p></div>}</section>}
        </>}

        {section === "tours" && <>
          {requester && compose && <TourCreateForm prefillOffer={prefillOffer} driverName={prefillOffer ? person(prefillOffer.driverId)?.name : undefined} privateUser={privateUser} pending={pending} onSubmit={submitTour} onClose={() => setCompose(false)} onClearPrefill={() => setPrefillOffer(null)}/>}
          <div className="list-toolbar"><div className="search-wrap"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Grad, adresa, teret ili naručilac" aria-label="Pretraži ture"/></div>{requester && <div className="select-wrap"><SlidersHorizontal size={17}/><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtriraj po statusu"><option value="all">Svi statusi</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>}<button className={`filter-toggle ${showTourFilters ? "active" : ""}`} aria-expanded={showTourFilters} onClick={() => setShowTourFilters(!showTourFilters)}><SlidersHorizontal size={16}/> Filteri {activeTourFilters > 0 && <b>{activeTourFilters}</b>}</button><span className="result-count">{filtered.length} {privateUser ? "zahteva" : "tura"}</span></div>
          {showTourFilters && <TourAdvancedFilters value={tourFilters} onChange={setTourFilters} driverRole={driverRole} onClear={resetTourSearch}/>}
          {filtered.length ? <div className="card-grid">{filtered.map(t => tourCard(t))}</div> : <div className="empty"><Search size={29}/><strong>{requester && !activeTourFilters ? "Još nema objavljenih zahteva." : "Nema tura za izabrani prikaz."}</strong><p>{requester && !activeTourFilters ? "Objavi šta treba prevesti i vozači će videti zahtev." : "Promeni pretragu ili filter da vidiš ostale ture."}</p>{activeTourFilters > 0 ? <button className="btn btn-outline" onClick={resetTourSearch}>Očisti filtere</button> : requester && <button className="btn btn-red" onClick={() => newTour()}>{privateUser ? "Objavi zahtev" : "Objavi turu"} <ArrowRight size={16}/></button>}</div>}
        </>}

        {section === "myrides" && <><div className="list-toolbar"><div className="search-wrap"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pretraži moje vožnje" aria-label="Pretraži moje vožnje"/></div><div className="select-wrap"><SlidersHorizontal size={17}/><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtriraj po statusu"><option value="all">Svi statusi</option>{Object.entries(statuses).filter(([key]) => key !== "open").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><button className={`filter-toggle ${showTourFilters ? "active" : ""}`} aria-expanded={showTourFilters} onClick={() => setShowTourFilters(!showTourFilters)}><SlidersHorizontal size={16}/> Filteri {activeTourFilters > 0 && <b>{activeTourFilters}</b>}</button><span className="result-count">{filtered.length} vožnji</span></div>{showTourFilters && <TourAdvancedFilters value={tourFilters} onChange={setTourFilters} driverRole={false} onClear={resetTourSearch}/>} {filtered.length ? <div className="card-grid">{filtered.map(t => tourCard(t))}</div> : <div className="empty"><Route size={29}/><strong>{activeTourFilters ? "Nema vožnji za izabrane filtere." : "Ovde će se pojaviti prihvaćene vožnje."}</strong><p>{activeTourFilters ? "Promeni uslove pretrage." : "Pronađi turu koja odgovara tvojoj ponudi i prihvati je."}</p>{activeTourFilters ? <button className="btn btn-outline" onClick={resetTourSearch}>Očisti filtere</button> : <button className="btn btn-red" onClick={() => go("tours")}>Pronađi turu <ArrowRight size={16}/></button>}</div>}</>}

        {section === "drivers" && <DriverAdsPanel offers={data.offers} people={data.people} photos={data.vehiclePhotos} reviews={data.recentReviews} onCreate={newTour} privateUser={privateUser}/>}

        {section === "offer" && myOffer?.active && <div className="capacity-banner"><PackageCheck size={19}/><span>Za nove ture trenutno je dostupno <strong>{myOffer.availableCapacity} t</strong>. Prihvaćene vožnje rezervišu {Math.max(0, myOffer.freeCapacity - myOffer.availableCapacity)} t od prijavljenog slobodnog prostora.</span></div>}
        {section === "offer" && <OfferPanel key={myOffer?.updatedAt || "new"} offer={myOffer} pending={pending} act={act}/>}
        {section === "messages" && <MessagesPanel data={data} chatId={chatId} setChatId={setChatId} pending={pending} act={act} person={person}/>}
        {section === "analytics" && <AnalyticsPanel tours={data.tours}/>}
        {section === "settings" && <div className="export-banner"><div className="export-icon"><Download size={20}/></div><div><strong>Preuzmi svoje podatke</strong><p>Profil, tvoje ture, ocene i poruke u JSON datoteci. Datoteka sadrži adrese i razgovore, pa je čuvaj privatno.</p></div><button className="btn btn-outline" disabled={exporting} onClick={() => void downloadData()}><Download size={16}/>{exporting ? "Priprema..." : "Preuzmi podatke"}</button></div>}
        {section === "settings" && <><SettingsPanel me={data.me} pending={pending} onSubmit={submitProfile} onSignOut={signOut}/><PasswordPanel auth={data.auth} pending={pending} onSubmit={updatePassword}/>{driverRole && <DriverPhotosPanel person={person(data.me.id)} photos={data.vehiclePhotos.filter(p => p.driverId === data.me.id)} pending={pending} upload={uploadPhoto} remove={removePhoto}/>}</>}
      </>}
      </main><footer className="app-footer"><span>© LST Ruta</span><span>Logistika u pokretu · <b>01 / 01</b></span></footer>
    </div>
    <nav className="mobile-nav" aria-label="Mobilna navigacija">{nav.map(({ id, label, icon: Icon, count }) => <button key={id} className={section === id ? "active" : ""} onClick={() => go(id)}><Icon size={19}/><span>{label}</span>{!!count && <i/>}</button>)}</nav>
  </div>;
}

function ProfileAvatar({ person, fallback }: { person?: Person; fallback: string }) {
  return person?.hasAvatar
    ? <img className="profile-avatar-img" src={`/api/media/avatar/${encodeURIComponent(person.id)}?v=${encodeURIComponent(person.updatedAt)}`} alt={`Fotografija: ${person.name}`}/>
    : <span>{fallback.slice(0, 1).toUpperCase()}</span>;
}

function SettingsPanel({ me, pending, onSubmit, onSignOut }: { me: User; pending: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onSignOut: () => Promise<void> }) {
  const company = me.role === "company";
  const driver = me.role === "driver";
  return <div className="settings-layout"><div className="form-card">
    <div className="form-card-head"><div><span className="eyebrow plain">PODACI NALOGA</span><h2>{company ? "Profil firme" : driver ? "Profil vozača" : "Moj profil"}</h2><p>Ime, korisničko ime i podaci o vozilu vide se uz tvoje oglase.</p></div><ShieldCheck size={23} className="red-icon"/></div>
    <form key={me.updatedAt} onSubmit={onSubmit} className="form-grid">
      {company ? <label>Naziv firme<input name="companyName" defaultValue={me.companyName || me.name} required minLength={2} maxLength={120}/></label> : <label>Ime i prezime<input name="name" defaultValue={me.name} required minLength={2} maxLength={120}/></label>}
      <label>Korisničko ime<input name="username" defaultValue={me.username || ""} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" placeholder="npr. moj_prevoz"/><small>Jedinstveno @ime; postojeći nalozi ga mogu dodati ovde.</small></label>
      <label>Email naloga<input value={me.email} readOnly className="readonly"/><small>Email je vezan za prijavu i ovde se ne menja.</small></label>
      {driver ? <><label>Polazni grad<input name="homeCity" defaultValue={me.homeCity || ""} placeholder="Grad"/></label><label>Tip vozila<select name="vehicleKind" defaultValue={me.vehicleKind || "Kombi"}><option>Kombi</option><option>Kamion</option><option>Šleper</option></select></label><label>Marka i model vozila<input name="vehicleModel" defaultValue={me.vehicleModel || ""} maxLength={100} placeholder="npr. Mercedes Sprinter"/></label><label className="span-2">O meni i usluzi<textarea name="bio" defaultValue={me.bio || ""} maxLength={500} rows={4} placeholder="Šta prevoziš, koje relacije pokrivaš i druge važne informacije"/></label></> : !company && <label>Mesto<input name="homeCity" defaultValue={me.homeCity || ""} placeholder="Grad"/></label>}
      <label>Telefon<input name="phone" type="tel" defaultValue={me.phone || ""} placeholder="+381 ..."/></label>
      <div className="form-actions span-2"><button className="btn btn-red" disabled={pending}>{pending ? "Čuvanje..." : "Sačuvaj izmene"} <Check size={16}/></button></div>
    </form>
  </div><div className="settings-aside"><div className="settings-icon"><ShieldCheck size={24}/></div><h3>Zaštićen nalog</h3><p>Prijava radi preko emaila ili korisničkog imena i lozinke. Korisničko ime i profil predstavljaju te na platformi.</p><div className="settings-role"><span>TIP NALOGA</span><strong>{company ? "Logistička firma" : driver ? "Vozač" : "Privatno lice"}</strong></div><button type="button" onClick={() => void onSignOut()} className="text-button">Odjavi se <ArrowUpRight size={16}/></button></div></div>;
}

function PasswordPanel({ auth, pending, onSubmit }: { auth: AppState["auth"]; pending: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="form-card password-panel"><div className="form-card-head"><div><span className="eyebrow plain">SIGURNOST NALOGA</span><h2>{auth.hasPassword ? "Promeni lozinku" : "Postavi lozinku"}</h2><p>{auth.hasPassword ? "Koristi novu lozinku pri sledećoj prijavi." : "Postavi lozinku za prijavu na ovaj profil."}</p></div><ShieldCheck size={23} className="red-icon"/></div>
    <form className="form-grid" onSubmit={onSubmit}>
      {auth.hasPassword && auth.source === "local" && <label>Trenutna lozinka<input name="currentPassword" type="password" autoComplete="current-password" required/></label>}
      <label>Nova lozinka<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required placeholder="Najmanje 12 znakova"/></label>
      <label>Ponovi novu lozinku<input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>
      <div className="form-actions span-2"><button className="btn btn-red" disabled={pending}>{pending ? "Čuvanje..." : auth.hasPassword ? "Promeni lozinku" : "Aktiviraj nezavisnu prijavu"} <ArrowRight size={16}/></button></div>
    </form>
  </section>;
}

function DriverPhotosPanel({ person, photos, pending, upload, remove }: {
  person?: Person; photos: VehiclePhoto[]; pending: boolean;
  upload: (kind: "avatar" | "vehicle", file: File) => Promise<void>;
  remove: (kind: "avatar" | "vehicle", id?: string) => Promise<void>;
}) {
  const pick = (kind: "avatar" | "vehicle") => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
    if (file) void upload(kind, file);
  };
  return <section className="form-card driver-photos-panel">
    <div className="form-card-head"><div><span className="eyebrow plain">PREDSTAVI SE</span><h2>Fotografije profila i vozila</h2><p>JPG, PNG ili WebP do 5 MB po slici. Slike se prikazuju uz tvoj oglas.</p></div><Camera size={23} className="red-icon"/></div>
    <div className="photo-profile-row"><div className="photo-profile-avatar"><ProfileAvatar person={person} fallback={person?.name || "V"}/></div><div><strong>Profilna fotografija</strong><p>Dodaj jasnu fotografiju po kojoj te naručioci prepoznaju.</p><div className="photo-actions"><label className="btn btn-outline photo-upload"><Camera size={15}/> {person?.hasAvatar ? "Zameni sliku" : "Dodaj sliku"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={pick("avatar")}/></label>{person?.hasAvatar && <button className="text-button danger" disabled={pending} onClick={() => void remove("avatar")}>Ukloni</button>}</div></div></div>
    <div className="photo-gallery-head"><div><strong>Slike vozila</strong><span>{photos.length} / 4 fotografije</span></div>{photos.length < 4 && <label className="btn btn-outline photo-upload"><ImagePlus size={15}/> Dodaj sliku vozila<input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={pick("vehicle")}/></label>}</div>
    {photos.length ? <div className="vehicle-gallery manage">{photos.map(photo => <div className="vehicle-photo" key={photo.id}><img src={vehiclePhotoUrl(photo.id)} alt={`Vozilo, slika ${photo.position + 1}`} loading="lazy"/><button type="button" aria-label={`Ukloni sliku vozila ${photo.position + 1}`} disabled={pending} onClick={() => void remove("vehicle", photo.id)}><Trash2 size={16}/></button></div>)}</div> : <div className="photo-empty"><Truck size={23}/> Dodaj slike spoljašnjosti i tovarnog prostora vozila.</div>}
  </section>;
}

function TourCreateForm({ prefillOffer, driverName, privateUser, pending, onSubmit, onClose, onClearPrefill }: {
  prefillOffer: Offer | null; driverName?: string; privateUser: boolean; pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void; onClearPrefill: () => void;
}) {
  return <div className="form-card">
    <div className="form-card-head"><div><span className="eyebrow plain">{privateUser ? "ZAHTEV ZA PREVOZ" : "NOVA TURA"}</span><h2>{privateUser ? "Šta treba prevesti?" : "Objavi prevoz"}</h2><p>Vozač će videti tačnu adresu i uslove pre prihvatanja.</p></div><button className="icon-button" aria-label="Zatvori formu" onClick={onClose}><X size={20}/></button></div>
    {prefillOffer && <div className="prefill-note"><Truck size={18}/><div><strong>Iz oglasa vozača {driverName || ""}</strong><span>{prefillOffer.adType === "general" ? "Predloženo je vozilo. Unesi svoju relaciju; vozač zatim odlučuje da li prihvata zahtev." : "Pravac i vozilo su predloženi. Vozač odlučuje da li prihvata objavljeni zahtev."}</span></div><button className="text-button" onClick={onClearPrefill}>Ukloni predlog</button></div>}
    <form key={prefillOffer?.id || "new"} onSubmit={onSubmit} className="form-grid">
      <div className="form-divider">01 <span>Preuzimanje</span></div>
      <label>Grad preuzimanja<input name="pickupCity" defaultValue={prefillOffer?.adType === "route" ? prefillOffer.originCity : ""} required minLength={2} placeholder="npr. Beograd"/></label>
      <label>Tačna adresa preuzimanja<input name="pickupAddress" required minLength={2} placeholder="Ulica i broj, objekat"/></label>
      <label className="span-2">Napomena za pristup<input name="pickupNotes" placeholder={privateUser ? "npr. Drva su u dvorištu, ulaz iz sporedne ulice" : "npr. Ulaz C, rampa 4, kontakt na kapiji"}/></label>
      <label className="span-2">Link do mape (opciono)<input name="pickupMapUrl" type="url" placeholder="https://maps.google.com/..."/></label>
      <div className="form-divider">02 <span>Odredište i teret</span></div>
      <label>Grad istovara<input name="dropoffCity" defaultValue={prefillOffer?.adType === "route" ? prefillOffer.destinationCity : ""} required minLength={2} placeholder="npr. Novi Sad"/></label>
      <label>Tačna adresa istovara<input name="dropoffAddress" required minLength={2} placeholder="Ulica i broj"/></label>
      <label>Šta se prevozi?<input name="cargoDescription" required minLength={2} placeholder={privateUser ? "npr. Ogrevna drva, nameštaj" : "npr. Paletirana roba"}/></label>
      <label>{privateUser ? "Približna težina (t)" : "Težina (t)"}<input name="cargoWeight" required type="number" min="0.01" max="25" step="0.01" placeholder={privateUser ? "npr. 1" : "2.5"}/></label>
      <div className="form-divider">03 <span>Uslovi prevoza</span></div>
      <label>Potrebno vozilo<select name="vehicleKind" defaultValue={prefillOffer?.vehicleKind || (privateUser ? "Bilo koje" : "Kombi")}>{privateUser && <option>Bilo koje</option>}<option>Kombi</option><option>Kamion</option><option>Šleper</option></select></label>
      <label>{privateUser ? "Predložena cena (RSD, opciono)" : "Cena (RSD)"}<input name="price" required={!privateUser} type="number" min={privateUser ? "0" : "1"} max="1000000" step="1" placeholder={privateUser ? "Prazno = po dogovoru" : "35000"}/></label>
      <label>Vreme polaska<input name="departureAt" required type="datetime-local" defaultValue={localDateTime(prefillOffer?.availableAt)}/></label>
      <div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose}>Odustani</button><button className="btn btn-red" disabled={pending}>{pending ? "Objavljivanje..." : privateUser ? "Objavi zahtev" : "Objavi turu"} <ArrowRight size={16}/></button></div>
    </form>
  </div>;
}

function RatingBadge({ person }: { person?: Person }) {
  if (!person) return null;
  return <span className="rating-badge" title={person.ratingCount ? `${person.ratingCount} ocena posle isporuke` : "Još nema ocena"}><Star size={14} fill={person.ratingCount ? "currentColor" : "none"}/>{person.ratingCount ? <>{person.ratingAverage.toFixed(1)} <small>({person.ratingCount})</small></> : <small>Nema ocena</small>}</span>;
}

function ReviewComments({ subjectId, reviews }: { subjectId?: string; reviews: ReviewNote[] }) {
  const comments = subjectId ? reviews.filter(review => review.subjectId === subjectId).slice(0, 5) : [];
  if (!comments.length) return null;
  return <details className="review-comments"><summary>Pročitaj iskustva ({comments.length})</summary><div className="review-comments-list">{comments.map((review, index) => <div className="review-comment" key={`${review.subjectId}-${review.createdAt}-${index}`}><span><Star size={13} fill="currentColor"/> {review.score}/5 · {new Date(review.createdAt).toLocaleDateString("sr-RS")}</span><p>{review.comment}</p></div>)}</div></details>;
}

function RouteMapPanel({ tour }: { tour: Tour }) {
  const [stop, setStop] = useState<"pickup" | "dropoff" | "route">("pickup");
  const [embedKey, setEmbedKey] = useState<string | null>(null);
  const [mapConfigLoaded, setMapConfigLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/maps-config", { cache: "no-store" })
      .then(async response => response.ok ? response.json() as Promise<{ key: string | null }> : { key: null })
      .then(config => { if (active) setEmbedKey(config.key); })
      .catch(() => { if (active) setEmbedKey(null); })
      .finally(() => { if (active) setMapConfigLoaded(true); });
    return () => { active = false; };
  }, []);
  const selectedAddress = stop === "pickup" ? mapAddress(tour.pickupAddress, tour.pickupCity) : stop === "dropoff" ? mapAddress(tour.dropoffAddress, tour.dropoffCity) : `${tour.pickupCity} → ${tour.dropoffCity}`;
  return <section className="route-map-panel" aria-label="Lokacije ture">
    <div className="route-map-head"><div><span className="eyebrow plain">LOKACIJE TURE</span><strong>Utovar i istovar</strong><p>{embedKey ? "Pregledaj mapu u aplikaciji. Za vođenje tokom vožnje pokreni navigaciju." : "Pregledaj adrese ture. Geografska mapa čeka povezivanje servisa."}</p></div><MapPin size={22}/></div>
    <div className="route-map-tabs" role="group" aria-label="Prikaz mape"><button type="button" aria-pressed={stop === "pickup"} className={stop === "pickup" ? "active" : ""} onClick={() => setStop("pickup")}>Utovar</button><button type="button" aria-pressed={stop === "dropoff"} className={stop === "dropoff" ? "active" : ""} onClick={() => setStop("dropoff")}>Istovar</button><button type="button" aria-pressed={stop === "route"} className={stop === "route" ? "active" : ""} onClick={() => setStop("route")}>Cela ruta</button></div>
    {embedKey ? <div className="route-map-frame"><iframe key={stop} src={mapEmbedUrl(tour, stop, embedKey)} title={`Mapa: ${selectedAddress}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/></div> : <div className="route-map-fallback"><div><span className="route-map-point"/><strong>{tour.pickupAddress}, {tour.pickupCity}</strong><small>UTOVAR</small></div><div className="route-map-track"/><div><span className="route-map-point end"/><strong>{tour.dropoffAddress}, {tour.dropoffCity}</strong><small>ISTOVAR</small></div><p>{mapConfigLoaded ? "Geografski prikaz u aplikaciji biće dostupan kada se doda Google Maps ključ." : "Učitavanje podešavanja mape..."}</p></div>}
    <div className="route-map-footer"><div><span>{stop === "pickup" ? "MESTO PREUZIMANJA" : stop === "dropoff" ? "MESTO ISTOVARA" : "RELACIJA"}</span><strong>{selectedAddress}</strong>{stop === "pickup" && tour.pickupNotes && <small>{tour.pickupNotes}</small>}</div><a className="btn btn-red" href={directionsUrl(tour, stop)} target="_blank" rel="noopener noreferrer">Pokreni navigaciju <ExternalLink size={15}/></a></div>
    {stop === "pickup" && tour.pickupMapUrl && <a className="route-map-custom" href={tour.pickupMapUrl} target="_blank" rel="noopener noreferrer">Otvori tačan link lokacije koji je postavio naručilac <ExternalLink size={13}/></a>}
  </section>;
}

function RatingForm({ tourId, targetName, previous, pending, act }: { tourId: string; targetName: string; previous?: { score: number; comment: string }; pending: boolean; act: (payload: Record<string, unknown>, message: string) => Promise<boolean> }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  return <div className="rating-form"><div><strong>Oceni {targetName}</strong><span>Posle završene vožnje · jedna ocena po turi</span></div>{previous ? <div className="rating-sent"><span className="rating-done"><Star size={16} fill="currentColor"/> Poslata ocena {previous.score}/5</span>{previous.comment && <p>{previous.comment}</p>}</div> : <div className="rating-compose"><div className="rating-controls"><div className="rating-stars" role="group" aria-label={`Ocena za ${targetName}`}>{[1,2,3,4,5].map(n => <button type="button" key={n} className={score >= n ? "selected" : ""} aria-label={`${n} od 5 zvezdica`} aria-pressed={score === n} onClick={() => setScore(n)}><Star size={23} fill={score >= n ? "currentColor" : "none"}/></button>)}</div></div><label>Dodaj komentar (opciono)<textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={600} rows={3} placeholder="Kakvo je bilo tvoje iskustvo sa ovom vožnjom?"/><small>Drugi korisnici mogu da pročitaju komentar. {comment.length}/600</small></label><button className="btn btn-red" disabled={pending || !score} onClick={() => void act({ type: "review.create", tourId, score, comment }, "Ocena i komentar su sačuvani.")}>Pošalji ocenu <ArrowRight size={15}/></button></div>}</div>;
}

function TourAdvancedFilters({ value, onChange, driverRole, onClear }: { value: TourFilters; onChange: (value: TourFilters) => void; driverRole: boolean; onClear: () => void }) {
  function update<K extends keyof TourFilters>(key: K, next: TourFilters[K]) { onChange({ ...value, [key]: next }); }
  return <div className="filter-panel"><div className="filter-panel-head"><div><strong>Uslovi pretrage</strong><span>Pretraži lokacije, vozilo, teret, vreme i cenu.</span></div><button type="button" onClick={onClear}>Očisti sve</button></div><div className="filter-grid">
    <label>Grad ili adresa utovara<input value={value.pickup} onChange={e => update("pickup", e.target.value)} placeholder="npr. Beograd"/></label>
    <label>Grad ili adresa istovara<input value={value.dropoff} onChange={e => update("dropoff", e.target.value)} placeholder="npr. Niš"/></label>
    <label>Potrebno vozilo<select value={value.vehicle} onChange={e => update("vehicle", e.target.value)}><option value="all">Sva vozila</option><option>Bilo koje</option><option>Kombi</option><option>Kamion</option><option>Šleper</option></select></label>
    <label>Teret od (t)<input type="number" min="0" max="25" step="0.01" value={value.minWeight} onChange={e => update("minWeight", e.target.value)} placeholder="npr. 1"/></label>
    <label>Teret do (t)<input type="number" min="0" max="25" step="0.01" value={value.maxWeight} onChange={e => update("maxWeight", e.target.value)} placeholder="npr. 3.5"/></label>
    <label>Cena od (RSD)<input type="number" min="0" step="1" value={value.minPrice} onChange={e => update("minPrice", e.target.value)} placeholder="Bez donje granice"/></label>
    <label>Cena do (RSD)<input type="number" min="0" step="1" value={value.maxPrice} onChange={e => update("maxPrice", e.target.value)} placeholder="Bez gornje granice"/></label>
    <label>Polazak od<input type="date" value={value.dateFrom} onChange={e => update("dateFrom", e.target.value)}/></label>
    <label>Polazak do<input type="date" value={value.dateTo} onChange={e => update("dateTo", e.target.value)}/></label>
    {driverRole && <label>Ko je objavio<select value={value.requesterType} onChange={e => update("requesterType", e.target.value)}><option value="all">Svi naručioci</option><option value="company">Firme</option><option value="private">Privatna lica</option></select></label>}
    <label>Redosled<select value={value.sort} onChange={e => update("sort", e.target.value)}><option value="newest">Najnovije ture</option><option value="soonest">Najbliži polazak</option><option value="priceAsc">Najniža cena</option><option value="priceDesc">Najviša cena</option><option value="weightDesc">Najteži teret</option></select></label>
    {driverRole && <label className="filter-check"><input type="checkbox" checked={value.fitsVehicle} onChange={e => update("fitsVehicle", e.target.checked)}/> Odgovara mom vozilu{value.fitsVehicle && <small>Proverava i slobodan prostor ako imaš aktivan oglas.</small>}</label>}
  </div></div>;
}

function DriverAdCard({ offer, driver, photos, reviews, onCreate, privateUser = false }: { offer: Offer; driver?: Person; photos: VehiclePhoto[]; reviews: ReviewNote[]; onCreate: () => void; privateUser?: boolean }) {
  return <article className="offer-card driver-ad">
    <div className="offer-card-head"><div className="driver-avatar"><ProfileAvatar person={driver} fallback={driver?.name || "V"}/></div><div><strong>{driver?.name || "Vozač"}</strong><span>{driver?.username ? `@${driver.username} · ` : ""}{driver?.homeCity || offer.originCity || offer.serviceArea}</span><RatingBadge person={driver}/></div><span className="ad-badge"><span/> {offer.adType === "general" ? "PREVOZ" : "RELACIJA"}</span></div>
    {offer.adType === "general" ? <div className="general-ad-heading"><Truck size={19}/><div><strong>Prevozim robu</strong><span>{offer.serviceArea}</span></div></div> : <div className="offer-route"><MapPin size={17}/><strong>{offer.originCity}</strong><ArrowRight size={18}/><strong>{offer.destinationCity}</strong></div>}
    {offer.description && <p className="ad-description">{offer.description}</p>}
    <div className="ad-facts"><div><Truck size={17}/><span>Vozilo<strong>{driver?.vehicleModel ? `${offer.vehicleKind} · ${driver.vehicleModel}` : offer.vehicleKind}</strong></span></div><div><PackageCheck size={17}/><span>Za nove ture<strong>{offer.availableCapacity} t dostupno</strong></span></div><div><CalendarDays size={17}/><span>Dostupan od<strong>{date(offer.availableAt)}</strong></span></div><div><ArrowDownRight size={17}/><span>U vozilu<strong>{offer.alreadyLoaded ? offer.currentCargo : "Prazno vozilo"}</strong></span></div></div>
    {driver?.bio && <p className="driver-bio">{driver.bio}</p>}
    {photos.length > 0 && <div className="vehicle-gallery ad-gallery">{photos.map(photo => <a href={vehiclePhotoUrl(photo.id)} target="_blank" rel="noreferrer" key={photo.id} title="Otvori fotografiju vozila"><img src={vehiclePhotoUrl(photo.id)} alt={`${driver?.name || "Vozač"}: vozilo ${photo.position + 1}`} loading="lazy"/></a>)}</div>}
    <ReviewComments subjectId={driver?.id} reviews={reviews}/>
    <button className="btn btn-outline full" onClick={onCreate}>{offer.adType === "general" ? (privateUser ? "Objavi zahtev za prevoz" : "Objavi turu") : (privateUser ? "Zatraži prevoz za ovaj smer" : "Objavi turu za ovaj smer")} <ArrowRight size={15}/></button>
  </article>;
}

function DriverAdsPanel({ offers, people, photos, reviews, onCreate, privateUser }: { offers: Offer[]; people: Person[]; photos: VehiclePhoto[]; reviews: ReviewNote[]; onCreate: (offer: Offer) => void; privateUser: boolean }) {
  const [query, setQuery] = useState("");
  const [vehicle, setVehicle] = useState("all");
  const [load, setLoad] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minimumFree, setMinimumFree] = useState("");
  const [minimumTotal, setMinimumTotal] = useState("");
  const [availableBy, setAvailableBy] = useState("");
  const [minRating, setMinRating] = useState("all");
  const [withPhotos, setWithPhotos] = useState(false);
  const [sort, setSort] = useState("newest");
  const activeCount = Number(!!query.trim()) + Number(vehicle !== "all") + Number(load !== "all") + Number(kind !== "all") + Number(!!from) + Number(!!to) + Number(!!minimumFree) + Number(!!minimumTotal) + Number(!!availableBy) + Number(minRating !== "all") + Number(withPhotos) + Number(sort !== "newest");
  function clear() { setQuery(""); setVehicle("all"); setLoad("all"); setKind("all"); setFrom(""); setTo(""); setMinimumFree(""); setMinimumTotal(""); setAvailableBy(""); setMinRating("all"); setWithPhotos(false); setSort("newest"); }
  const q = query.trim().toLocaleLowerCase("sr");
  const shown = offers.filter(offer => {
    const driver = people.find(p => p.id === offer.driverId);
    const searchable = `${offer.originCity} ${offer.destinationCity} ${offer.serviceArea} ${offer.description} ${offer.vehicleKind} ${offer.currentCargo} ${driver?.name || ""} ${driver?.username || ""} ${driver?.homeCity || ""} ${driver?.vehicleModel || ""}`.toLocaleLowerCase("sr");
    return searchable.includes(q) && (vehicle === "all" || offer.vehicleKind === vehicle) &&
      (load === "all" || (load === "loaded") === offer.alreadyLoaded)
      && (kind === "all" || offer.adType === kind)
      && includes(offer.adType === "general" ? offer.serviceArea : offer.originCity, from)
      && includes(`${offer.destinationCity} ${offer.adType === "general" ? offer.serviceArea : ""}`, to)
      && numberAtLeast(offer.availableCapacity, minimumFree)
      && numberAtLeast(offer.totalCapacity, minimumTotal)
      && withinDates(offer.availableAt, "", availableBy)
      && (minRating === "all" || (driver?.ratingCount && driver.ratingAverage >= Number(minRating)))
      && (!withPhotos || photos.some(photo => photo.driverId === offer.driverId));
  }).sort((a, b) => {
    if (sort === "capacity") return b.availableCapacity - a.availableCapacity;
    if (sort === "soonest") return new Date(a.availableAt).getTime() - new Date(b.availableAt).getTime();
    if (sort === "rating") return (people.find(p => p.id === b.driverId)?.ratingAverage ?? 0) - (people.find(p => p.id === a.driverId)?.ratingAverage ?? 0);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return <>
    <div className="ads-intro"><div className="ads-intro-icon"><Users size={22}/></div><div><strong>Vozači nude relacije i usluge prevoza.</strong><p>Pronađi vozilo, proveri slobodan prostor i objavi zahtev za konkretnu vožnju.</p></div><span>{offers.length} aktivnih oglasa</span></div>
    <div className="list-toolbar ads-toolbar"><div className="search-wrap"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Grad, oblast, vozač ili roba" aria-label="Pretraži oglase vozača"/></div><div className="select-wrap"><Truck size={16}/><select value={vehicle} onChange={event => setVehicle(event.target.value)} aria-label="Filtriraj po vozilu"><option value="all">Sva vozila</option><option>Kombi</option><option>Kamion</option><option>Šleper</option></select></div><button className={`filter-toggle ${expanded ? "active" : ""}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={16}/> Filteri {activeCount > 0 && <b>{activeCount}</b>}</button><span className="result-count">{shown.length} oglasa</span></div>
    {expanded && <div className="filter-panel"><div className="filter-panel-head"><div><strong>Pronađi prevoznika</strong><span>Odaberi samo uslove koji su ti važni.</span></div><button type="button" onClick={clear}>Očisti sve</button></div><div className="filter-grid">
      <label>Vrsta oglasa<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">Sve ponude</option><option value="route">Određena relacija</option><option value="general">Prevozim robu</option></select></label>
      <label>Trenutni teret<select value={load} onChange={e => setLoad(e.target.value)}><option value="all">Svejedno</option><option value="empty">Prazno vozilo</option><option value="loaded">Već natovareno</option></select></label>
      <label>Polazak ili područje<input value={from} onChange={e => setFrom(e.target.value)} placeholder="npr. Beograd"/></label>
      <label>Odredište ili područje<input value={to} onChange={e => setTo(e.target.value)} placeholder="npr. Novi Sad"/></label>
      <label>Slobodno najmanje (t)<input type="number" min="0" max="25" step="0.01" value={minimumFree} onChange={e => setMinimumFree(e.target.value)} placeholder="npr. 2"/></label>
      <label>Ukupna nosivost najmanje (t)<input type="number" min="0" max="25" step="0.01" value={minimumTotal} onChange={e => setMinimumTotal(e.target.value)} placeholder="npr. 3.5"/></label>
      <label>Dostupan najkasnije<input type="date" value={availableBy} onChange={e => setAvailableBy(e.target.value)}/></label>
      <label>Najmanja ocena<select value={minRating} onChange={e => setMinRating(e.target.value)}><option value="all">Sve ocene</option><option value="3">3+ zvezdice</option><option value="4">4+ zvezdice</option><option value="4.5">4.5+ zvezdica</option></select></label>
      <label>Redosled<select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Najnoviji oglasi</option><option value="capacity">Najviše slobodnog prostora</option><option value="soonest">Najranije dostupan</option><option value="rating">Najbolje ocenjeni</option></select></label>
      <label className="filter-check"><input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)}/> Samo sa slikama vozila</label>
    </div></div>}
    {shown.length ? <div className="card-grid">{shown.map(offer => <DriverAdCard key={offer.id} offer={offer} driver={people.find(p => p.id === offer.driverId)} photos={photos.filter(p => p.driverId === offer.driverId)} reviews={reviews} onCreate={() => onCreate(offer)} privateUser={privateUser}/>)}</div> : <div className="empty"><Search size={29}/><strong>{offers.length ? "Nema oglasa za izabrane filtere." : "Još nema oglasa vozača."}</strong><p>{offers.length ? "Promeni pretragu ili filtere." : "Ponude vozača će se pojaviti čim ih objave."}</p>{activeCount > 0 && <button className="btn btn-outline" onClick={clear}>Očisti filtere</button>}</div>}
  </>;
}

function DirectAcceptForm({ tour, profileVehicle, reservedWeight, pending, error, onClose, act }: {
  tour: Tour; profileVehicle: string | null | undefined; reservedWeight: number; pending: boolean; error: string; onClose: () => void;
  act: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
}) {
  const needed = Number((tour.cargoWeight + reservedWeight).toFixed(2));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void act({ type: "tour.accept", tourId: tour.id, vehicleKind: fields.get("vehicleKind"), freeCapacity: fields.get("freeCapacity") }, "Prihvatio si turu. Sada možeš pisati naručiocu.").then(ok => { if (ok) onClose(); });
  }
  return <form className="direct-accept form-grid" onSubmit={submit}>
    <div className="direct-accept-heading span-2"><div><span className="eyebrow plain">BRZA POTVRDA</span><strong>Potvrdi vozilo i prostor</strong><p>Javni oglas nije potreban za prihvatanje ture.</p></div><button type="button" className="icon-button" aria-label="Zatvori potvrdu" onClick={onClose}><X size={18}/></button></div>
    <div className="direct-accept-details span-2"><Truck size={17}/><span>Za ovu turu je potrebno <strong>{tour.vehicleKind === "Bilo koje" ? "bilo koje vozilo" : tour.vehicleKind}</strong> i najmanje <strong>{tour.cargoWeight} t</strong> slobodnog prostora.</span></div>
    <label>Vozilo kojim voziš<select name="vehicleKind" defaultValue={tour.vehicleKind === "Bilo koje" ? profileVehicle || "Kombi" : tour.vehicleKind} required><option>Kombi</option><option>Kamion</option><option>Šleper</option></select></label>
    <label>Slobodan prostor u vozilu (t)<input name="freeCapacity" type="number" step="0.01" min={needed} max="25" placeholder="npr. 3" required/><small>Ne računaj teret koji je već natovaren u vozilu.</small></label>
    {reservedWeight > 0 && <p className="direct-accept-reserved span-2">Aktivne vožnje već rezervišu {reservedWeight} t. Unesi slobodan prostor pre tih rezervacija; za ovu turu treba ukupno najmanje {needed} t.</p>}
    {error && <p className="direct-accept-error span-2" role="alert">{error}</p>}
    <div className="direct-accept-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Odustani</button><button type="submit" className="btn btn-red" disabled={pending || needed > 25}>{pending ? "Prihvatanje..." : "Potvrdi prihvatanje"} <ArrowRight size={15}/></button></div>
    {needed > 25 && <p className="direct-accept-reserved span-2">Nema dovoljno prostora za ovu i već prihvaćene ture.</p>}
  </form>;
}

function OfferPanel({ offer, pending, act }: { offer?: Offer; pending: boolean; act: (payload: Record<string, unknown>, message: string) => Promise<boolean> }) {
  const [loaded, setLoaded] = useState(!!offer?.alreadyLoaded);
  const [adType, setAdType] = useState<"route" | "general">(offer?.adType || "general");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    void act({
      type: "offer.upsert", adType,
      originCity: adType === "route" ? f.get("originCity") : "",
      destinationCity: adType === "route" ? f.get("destinationCity") : "",
      serviceArea: adType === "general" ? f.get("serviceArea") : "",
      description: f.get("description") || "",
      vehicleKind: f.get("vehicleKind"), totalCapacity: f.get("totalCapacity"), freeCapacity: f.get("freeCapacity"),
      alreadyLoaded: loaded, currentCargo: loaded ? f.get("currentCargo") : "",
      availableAt: new Date(String(f.get("availableAt"))).toISOString(),
    }, "Oglas je aktivan i vidljiv firmama i privatnim licima.");
  }
  return <div className="offer-layout"><div className="form-card">
    <div className="form-card-head"><div><span className="eyebrow plain">{offer?.active ? "AKTIVAN OGLAS" : "NOVI OGLAS"}</span><h2>{offer?.active ? "Uredi svoj oglas" : "Ponudi prevoz"}</h2><p>Izaberi relaciju ili jednostavno napiši kakav prevoz nudiš.</p></div><div className="form-heading-icon"><Truck size={23}/></div></div>
    <form className="form-grid" onSubmit={submit}>
      <div className="form-divider">01 <span>Vrsta oglasa</span></div>
      <div className="offer-type-picker span-2" role="group" aria-label="Vrsta oglasa">
        <button type="button" aria-pressed={adType === "general"} className={adType === "general" ? "selected" : ""} onClick={() => setAdType("general")}><Truck size={20}/><strong>Prevozim robu</strong><small>Opiši uslugu i područje. Relacija nije obavezna.</small></button>
        <button type="button" aria-pressed={adType === "route"} className={adType === "route" ? "selected" : ""} onClick={() => setAdType("route")}><Route size={20}/><strong>Vozim na relaciji</strong><small>Navedi polazni i odredišni grad.</small></button>
      </div>
      {adType === "route" ? <><div className="form-divider">02 <span>Pravac kretanja</span></div><label>Krećem iz<input name="originCity" defaultValue={offer?.originCity} required minLength={2} maxLength={120} placeholder="npr. Beograd"/></label><label>Idem ka<input name="destinationCity" defaultValue={offer?.destinationCity} required minLength={2} maxLength={120} placeholder="npr. Novi Sad"/></label></> : <><div className="form-divider">02 <span>Područje i usluga</span></div><label className="span-2">Gde prevoziš robu?<input name="serviceArea" defaultValue={offer?.serviceArea} required minLength={2} maxLength={120} placeholder="npr. Beograd i okolina, cela Srbija"/><small>Možeš navesti grad, region ili celu zemlju.</small></label></>}
      <label className="span-2">{adType === "general" ? "Šta prevoziš i koje usluge nudiš?" : "Dodatne informacije (opciono)"}<textarea name="description" key={adType} defaultValue={offer?.description} required={adType === "general"} minLength={adType === "general" ? 10 : undefined} maxLength={500} rows={3} placeholder="npr. Prevozim nameštaj, robu i palete. Pomažem pri utovaru po dogovoru."/></label>
      <div className="form-divider">03 <span>Vozilo i slobodan prostor</span></div>
      <label>Tip vozila<select name="vehicleKind" defaultValue={offer?.vehicleKind || "Kombi"}><option>Kombi</option><option>Kamion</option><option>Šleper</option></select></label>
      <label>Ukupna nosivost (t)<input name="totalCapacity" type="number" min="0.01" max="25" step="0.01" defaultValue={offer?.totalCapacity} required placeholder="3.5"/></label>
      <label>Slobodno za novu robu (t)<input name="freeCapacity" type="number" min="0.01" max="25" step="0.01" defaultValue={offer?.freeCapacity} required placeholder="2.0"/></label>
      <label>Dostupan od<input name="availableAt" type="datetime-local" defaultValue={localDateTime(offer?.availableAt)} required/></label>
      <div className="span-2"><label className="check-row"><input type="checkbox" checked={loaded} onChange={e => setLoaded(e.target.checked)}/><span>Već imam nešto natovareno</span></label></div>
      {loaded && <label className="span-2">Šta je trenutno u vozilu?<input name="currentCargo" defaultValue={offer?.currentCargo} required minLength={2} placeholder="npr. Dve palete nameštaja"/></label>}
      <div className="form-actions span-2"><button className="btn btn-red" disabled={pending}>{pending ? "Čuvanje..." : offer?.active ? "Sačuvaj oglas" : "Objavi oglas"} <ArrowRight size={16}/></button>{offer?.active && <button type="button" className="btn btn-outline danger" disabled={pending} onClick={() => { if (window.confirm("Ukloniti aktivan oglas?")) void act({ type: "offer.remove" }, "Oglas je uklonjen."); }}>Ukloni oglas</button>}</div>
    </form>
  </div><div className="offer-tip"><div className="tip-icon"><Compass size={24}/></div><span>ŠTA NARUČIOCI VIDE</span><h3>Jasan oglas štedi vreme.</h3><p>Opis usluge, područje, vozilo, slobodan prostor i postojeći teret pomažu firmama i privatnim licima da pronađu pravog vozača.</p><div className="tip-rule"/><span>ZA PRIHVATANJE TURE</span><p>Oglas nije obavezan. Bez oglasa potvrđuješ vozilo i slobodan prostor direktno na kartici ture.</p></div></div>;
}

function MessagesPanel({ data, chatId, setChatId, pending, act, person }: { data: AppState; chatId: string | null; setChatId: (id: string) => void; pending: boolean; act: (payload: Record<string, unknown>, message: string) => Promise<boolean>; person: (id: string | null) => Person | undefined }) {
  const threads = data.tours.filter(t => !!t.driverId);
  const selected = threads.find(t => t.id === chatId) || threads[0];
  const msgs = data.messages.filter(m => m.tourId === selected?.id);
  function select(t: Tour) { setChatId(t.id); if (data.messages.some(m => m.tourId === t.id && m.recipientId === data.me.id && !m.readAt)) void act({ type: "message.read", tourId: t.id }, ""); }
  function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = event.currentTarget; const f = new FormData(form); const body = String(f.get("body") || "").trim(); if (!body) return; void act({ type: "message.send", tourId: selected.id, body }, "Poruka je poslata.").then(ok => { if (ok) form.reset(); }); }
  if (!threads.length) return <div className="empty"><MessageCircle size={30}/><strong>Razgovori će se pojaviti kada vozač prihvati turu.</strong><p>Svaka poruka ostaje vezana za konkretnu vožnju.</p></div>;
  const other = selected && person(data.me.role === "driver" ? selected.companyId : selected.driverId);
  return <div className="messaging"><div className="thread-list"><div className="thread-title"><span>RAZGOVORI</span><strong>{threads.length}</strong></div>{threads.map(t => { const counterpart = person(data.me.role === "driver" ? t.companyId : t.driverId); const latest = data.messages.filter(m => m.tourId === t.id).at(-1); const count = data.messages.filter(m => m.tourId === t.id && m.recipientId === data.me.id && !m.readAt).length; return <button key={t.id} className={`thread ${selected?.id === t.id ? "selected" : ""}`} onClick={() => select(t)}><div className="thread-avatar">{(counterpart?.companyName || counterpart?.name || "T")[0]}</div><div><strong>{counterpart?.companyName || counterpart?.name || "Tura"}</strong><span>{t.pickupCity} → {t.dropoffCity}</span><small>{latest?.body || "Nema poruka. Započni razgovor."}</small></div>{count > 0 && <em>{count}</em>}</button>; })}</div><div className="chat"><div className="chat-header"><div className="thread-avatar">{(other?.companyName || other?.name || "T")[0]}</div><div><strong>{other?.companyName || other?.name}</strong><span>{selected?.pickupCity} → {selected?.dropoffCity} · {selected && statuses[selected.status]}</span></div></div><div className="chat-body">{!msgs.length && <div className="chat-empty"><MessageCircle size={28}/><strong>Započni razgovor</strong><p>Dogovor za ovu turu ostaje sačuvan ovde.</p></div>}{msgs.map(m => <div key={m.id} className={`bubble ${m.senderId === data.me.id ? "mine" : "theirs"}`}><p>{m.body}</p><time>{date(m.createdAt)}</time></div>)}</div><form className="chat-compose" onSubmit={send}><input name="body" required minLength={1} maxLength={1000} placeholder="Napiši poruku..." aria-label="Nova poruka"/><button aria-label="Pošalji poruku" disabled={pending}><Send size={18}/></button></form></div></div>;
}

function AnalyticsPanel({ tours }: { tours: Tour[] }) {
  const delivered = tours.filter(t => t.status === "delivered"); const total = delivered.reduce((sum, t) => sum + t.price, 0); const byStatus = Object.entries(statuses).map(([key, label]) => ({ key, label, count: tours.filter(t => t.status === key).length }));
  return <div className="analytics"><div className="stats-grid"><div className="stat-card accent"><div className="stat-icon"><Route size={19}/></div><strong>{tours.length}</strong><span>Objavljene ture</span></div><div className="stat-card"><div className="stat-icon"><PackageCheck size={19}/></div><strong>{delivered.length}</strong><span>Isporučene ture</span></div><div className="stat-card"><div className="stat-icon"><Wallet size={19}/></div><strong className="money-stat">{money(total)}</strong><span>Vrednost isporučenih tura</span></div></div><div className="analytics-panel"><div><span className="eyebrow plain">PREGLED STATUSA</span><h2>Ture po statusu</h2><p>Brojevi se računaju iz stvarnih tura tvog naloga.</p></div><div className="status-bars">{byStatus.map(s => <div className="status-row" key={s.key}><span>{s.label}</span><div className="bar-track"><div style={{ width: `${tours.length ? s.count / tours.length * 100 : 0}%` }}/></div><strong>{s.count}</strong></div>)}</div></div></div>;
}
