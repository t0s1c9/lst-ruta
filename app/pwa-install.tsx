"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { Download, MoreVertical, PlusSquare, Share2, X } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type InstallContext = { installed: boolean; install: () => Promise<void> };
const Context = createContext<InstallContext | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [guide, setGuide] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");

  useEffect(() => {
    const initial = window.setTimeout(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      if (standalone) setInstalled(true);
      const ua = navigator.userAgent;
      setPlatform(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
        ? "ios" : /Android/.test(ua) ? "android" : "desktop");
    }, 0);

    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setGuide(false); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // The site still works in browsers without service worker support.
      });
    }
    return () => {
      clearTimeout(initial);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (prompt) {
      const current = prompt;
      setPrompt(null);
      try {
        await current.prompt();
        const choice = await current.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
      } catch { setGuide(true); }
    } else setGuide(true);
  }

  return <Context.Provider value={{ installed, install }}>
    {children}
    {guide && <div className="install-overlay" onClick={() => setGuide(false)}>
      <div className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") setGuide(false); }}>
        <button className="install-close" aria-label="Zatvori uputstvo" onClick={() => setGuide(false)} autoFocus><X size={19}/></button>
        <div className="install-app-icon"><Image src="/icons/icon-192.png" alt="LST Ruta ikonica" width={55} height={55} unoptimized/></div>
        <span className="install-kicker">LST RUTA ZA TVOJ UREĐAJ</span>
        <h2 id="install-title">Instaliraj aplikaciju.</h2>
        <p>LST Ruta će se pojaviti među aplikacijama i otvarati preko celog ekrana. Za ture, poruke i prijavu potrebna je internet veza.</p>
        {platform === "android" ? <ol className="install-steps"><li><MoreVertical size={18}/><span>Otvori ovaj link u <strong>Chrome</strong> pregledaču.</span></li><li><MoreVertical size={18}/><span>Dodirni meni sa <strong>tri tačke</strong> gore desno.</span></li><li><Download size={18}/><span>Izaberi <strong>Instaliraj aplikaciju</strong> ili <strong>Dodaj na početni ekran</strong>.</span></li></ol>
          : platform === "ios" ? <ol className="install-steps"><li><Share2 size={18}/><span>Otvori ovaj link u <strong>Safari</strong> pregledaču.</span></li><li><Share2 size={18}/><span>Dodirni dugme <strong>Deljenje</strong>.</span></li><li><PlusSquare size={18}/><span>Izaberi <strong>Dodaj na početni ekran</strong>.</span></li></ol>
          : <ol className="install-steps"><li><MoreVertical size={18}/><span>Otvori sajt u <strong>Chrome</strong> pregledaču.</span></li><li><Download size={18}/><span>Klikni ikonicu za instalaciju u adresnoj liniji ili u meniju.</span></li><li><PlusSquare size={18}/><span>Potvrdi <strong>Instaliraj</strong>.</span></li></ol>}
        <button className="btn btn-red install-done" onClick={() => setGuide(false)}>Razumem</button>
      </div>
    </div>}
  </Context.Provider>;
}

export function InstallButton({ className = "", label = "Preuzmi aplikaciju" }: { className?: string; label?: string }) {
  const context = useContext(Context);
  if (!context || context.installed) return null;
  return <button type="button" className={`install-button ${className}`} onClick={() => void context.install()}><Download size={17}/><span>{label}</span></button>;
}
