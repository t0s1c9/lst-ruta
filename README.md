# LST Ruta — samostalna verzija

Ovo je izvorni kod aplikacije za firme, vozače i privatna lica. Posle objavljivanja na svom Cloudflare nalogu dobijaš javnu adresu oblika `https://lst-ruta.<tvoj-pod-domen>.workers.dev`. Ta adresa radi van ChatGPT Sites i možeš je poslati drugima. Nije potreban kupljen domen.

## Šta je potrebno

- Cloudflare nalog na kom su dostupni Workers, D1 i R2.
- Node.js 22.13 ili noviji i npm na računaru sa kog objavljuješ aplikaciju.
- Terminal u raspakovanom folderu.

## Objavljivanje

1. Instaliraj zavisnosti: `npm ci`.
2. Poveži svoj Cloudflare nalog: `npx wrangler login`. Prijava se obavlja u tvom pregledaču.
3. Napravi bazu: `npx wrangler d1 create lst-ruta-db`. Iz odgovora kopiraj vrednost `database_id` u `wrangler.jsonc` na mesto `00000000-0000-4000-8000-000000000000`. Ako Wrangler ponudi da sam upiše konfiguraciju, proveri da je `DB` ostao naziv veze.
4. Napravi skladište slika: `npx wrangler r2 bucket create lst-ruta-photos`. Ako Cloudflare zatraži aktivaciju R2, završi je u svom nalogu.
5. Postavi strukturu baze: `npm run db:remote`.
6. Objavi aplikaciju: `npm run deploy`. Wrangler će ispisati tačnu `workers.dev` adresu. Ako traži uključivanje tog poddomena, potvrdi u svom nalogu.

Za promenu naziva linka promeni polje `name` u `wrangler.jsonc` pre prvog objavljivanja. Ako nazivi baze ili skladišta već postoje u tvom nalogu, izaberi druge i promeni odgovarajuća polja `database_name` odnosno `bucket_name` u istom fajlu.

Pri sledećoj izmeni ponovo pokreni `npm run db:remote`, pa `npm run deploy`. Za lokalni rad: `npm run db:local` i `npm run dev`. Provera gotove verzije: `npm run build` i `npm run preview`.

## Važne napomene

- Ovo objavljivanje pravi **novu, praznu bazu**. Nalozi, ture, poruke, ocene i slike sa starog `chatgpt.site` sajta se ne prenose automatski. Sačuvaj stari sajt dok se podaci ne izvezu i prebace zasebno. Lozinke su vezane za staru bazu; postojeći korisnici se na novoj adresi registruju ponovo dok se ne uradi migracija.
- Prijava u ovoj verziji koristi email ili korisničko ime i lozinku. Email potvrda i automatski reset lozinke još nisu uvedeni. Ovo je verzija za probu sa društvom; pre zvanične upotrebe treba dodati te korake i pravila o privatnosti.
- Fotografije profila i vozila se čuvaju u privatnom R2 skladištu. Baza je D1. Kod nema ChatGPT zavisnost za naloge.
- Pregled adresa i link za navigaciju rade bez ključa. Za ugrađenu Google mapu u aplikaciji potreban je Google Maps Embed API ključ; dodaš ga komandom `npx wrangler secret put GOOGLE_MAPS_EMBED_KEY`, pa ponovo objaviš. Google uslugu aktiviraš u svom nalogu prema njenim uslovima.
- Nije potrebno slati API token, lozinku ili pristupne podatke bilo kome. Komanda `wrangler login` otvara zvaničnu prijavu u tvom pregledaču.

Tehnologija: React/Next API preko vinext, Cloudflare Workers, D1, R2 i instalabilna PWA za telefon i desktop.
