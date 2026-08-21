# Körjournal

Mobilapp (PWA) för att registrera resor och skicka in körjournalen som PDF via mejl.
Ingen server, ingen inloggning – all data ligger i telefonen (localStorage).

## Fält per resa

KUND · KONTAKT · SYFTE · ORDERNR · VERKSAMHET · DATUM · TID · MÄTARSTÄLLNING START ·
MÄTARSTÄLLNING STOPP · KM · ADRESS START · ADRESS STOPP · TRÄNGSELSKATT · PERSON · REGNR

**Trängselskatten läggs in en passage i taget.** Skriv beloppet, tryck *+ Lägg till passage*, upprepa.
Varje passage blir en gul bricka som går att ta bort med ett tryck, och appen summerar dem åt
dig. Summan är det som hamnar i journalen.

Klockslaget vid start fylls i automatiskt när du öppnar en ny resa, och tiden framme sätts när
du sparar den avslutad. Båda går att ändra.

## Påbörja nu, avsluta senare

En resa kan sparas med bara startadress och startmätarställning. Den hamnar överst i listan med
gul ram och knappen *Avsluta* – öppna den när du är framme och fyll i resten. Påbörjade resor
följer aldrig med i ett utskick.

KM räknas ut automatiskt. Mätarställning start och adress start förifylls från förra resan.
DATUM skrivs som ÅÅMMDD i PDF/Excel-exporten, precis som i det befintliga Excel-arket.

## Fasta val – föraren konfigurerar ingenting

Allt som inte är en resa ligger som konstanter högst upp i `app.js`:

| | |
|---|---|
| Förare | GEORGE, EBBA |
| Bilar | **BMW520D** – 25 kr/mil, 0,7 l/mil · **BUDBIL** – ingen milersättning, 1,0 l/mil |
| Verksamhet | FILTER, MUSIK |
| Mottagare | george@airstrategy.se |
| Dieselpris | 20,00 kr/l som riktvärde, ändras i adminpanelen |

Lägg till en förare eller ändra en förbrukning genom att ändra `DRIVERS`, `CARS` eller
`VERKSAMHETER`. Föraren möter bara knappar: förare, bil, verksamhet. Det finns ingen
inställningsvy – regnummer, dieselpris, mottagaradress och säkerhetskopia ligger i adminpanelen.

Bilen sparas både som namn (BMW520D/BUDBIL) och som regnummer i journalen. Saknar budbilen
regnummer skrivs `BUDBIL` tills det fylls i under Admin → Bilar.

## Adresser från kartan

Adressfälten slår upp adressen mot OpenStreetMap medan du skriver och blandar träffarna med
dina tidigare adresser. Sikteknappen bredvid fältet hämtar din nuvarande position och fyller i
gatuadressen – tryck på den vid start och igen när du är framme.

Knappen **Hämta mätarställning från kartposition** under stoppfältet räknar ut körvägen mellan
adresserna (OSRM) och lägger den på startvärdet. Det är ett *förslag* som ska stämmas av mot
mätaren – kartan känner inte till omvägar, och en körjournal ska bygga på avlästa värden.

Uppslagen kräver nät. Utan täckning fungerar fälten som vanligt med historiken som förslag.
Appen kan inte känna av framkomst av sig själv i bakgrunden – iOS och Android stänger av
webbappar som inte är öppna. För automatisk resegistrering krävs en riktig native-app.

## Ersättning

BMW520D ger 25 kr/mil. BUDBIL ger ingen milersättning – körningen loggas och kostnadsförs ändå.

Sammanställningen är uppdelad i tre delar och visas i appen, i PDF:en och i mejltexten:

* **Milersättning** per bil
* **Utlägg** – trängselskatt
* **Att ersätta** – milersättning + utlägg

Därunder ligger **beräknad bränslekostnad** för bokföringen: varje bil har en förbrukning i
l/mil och dieselpriset sätts i adminpanelen. Kostnaden räknas per resa (syns direkt i
formuläret under kilometerrutan), som egen kolumn i PDF:en och som summa per bil. Den ingår
inte i ersättningen.

## Skicka in

**Skicka in körjournal** bygger en A4-PDF (liggande) för vald period och förare och öppnar
telefonens delningsruta. Välj mejlappen så följer rapporten med som bilaga; adress och ämne
skrivs i mejlet.

Att få både mottagare och bilaga automatiskt ifyllt går inte från en webbapp: delningsrutan kan
bifoga men inte adressera, och `mailto:` kan adressera men inte bifoga. Rapporten väger tyngst,
så appen tar den vägen. Vill man ha allt automatiskt är servern nedan svaret.

**Avsändaren blir alltid det mejlkonto som är inloggat i telefonen** – George skickar från sin
adress, Ebba från sin. En gemensam avsändaradress skulle kräva en server som skickar mejlet.

Extra: **Kopiera rader för Excel** lägger raderna på urklipp (tabbseparerat) för inklistring
i det gamla arket.

## Utskick direkt från appen (server)

`server/` innehåller en Cloudflare Worker som tar emot PDF:en och mejlar den via Resend. När den
är uppsatt blir utskicket **en enda knapp** – adress, ämne och bilaga sköts av servern.

Mottagaradressen ligger i serverns miljövariabler, inte i appen. Den som hittar adressen till
funktionen kan alltså bara skicka en körjournal till er egen inkorg.

```bash
cd KORJOURNAL/server
npx wrangler login
npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
```

Innan det: skapa ett konto på resend.com och verifiera avsändardomänen (DNS-poster som
IT-ansvarig lägger in). Justera `TO_EMAIL`, `FROM_EMAIL` och `ALLOWED_ORIGIN` i `wrangler.toml`.

Klistra sedan in adressen wrangler skriver ut (`https://korjournal-mail....workers.dev`) i
**Admin → Utskicksadress**. Lämnas fältet tomt används mejlappen i två steg som förut. Går
utskicket inte fram visas de manuella stegen automatiskt igen, och inga resor bockas av.

## Egen domän

GitHub Pages kan ligga på er egen adress, t.ex. `korjournal.airstrategy.se`:

1. Lägg en fil `CNAME` i repots rot med enbart domännamnet
2. DNS-post: `CNAME korjournal → hedlundo.github.io`
3. Settings → Pages → Custom domain → skriv adressen → *Enforce HTTPS*
4. Ändra `ALLOWED_ORIGIN` i `wrangler.toml` till den nya adressen och kör `npx wrangler deploy`

**Byt adress innan appen används skarpt.** Resorna ligger i webbläsarens lagring per adress, så
allt som registrerats på `github.io` följer inte med till den nya domänen. Behöver du flytta i
efterhand: exportera säkerhetskopian först, öppna den nya adressen och importera. Face ID måste
också registreras om, eftersom nyckeln är knuten till domänen.

## Köra lokalt

```bash
node KORJOURNAL/server.js
```

Öppna http://localhost:8123

## Publicera

Alla filer är statiska – lägg mappen på valfri HTTPS-värd.

* **Netlify Drop** – dra mappen till https://app.netlify.com/drop, klart på en minut.
* **GitHub Pages** – pusha repot och slå på Pages för branch `main`, mapp `/ (root)`.

HTTPS krävs för att appen ska gå att installera på hemskärmen och fungera offline.

## Installera på telefonen

* **iPhone:** öppna adressen i Safari → Dela → *Lägg till på hemskärmen*.
* **Android:** öppna i Chrome → menyn → *Installera app*.

## Var ligger resorna?

I telefonens `localStorage`, under appens adress. Ingen server, ingen molnkopia. Det betyder att
datan försvinner om du rensar webbläsardata, avinstallerar appen eller byter telefon.

Tre skydd finns:

1. **Säkerhetskopia** – Admin → *Exportera säkerhetskopia (JSON)*. Filen innehåller alla
   resor och inställningar och läses tillbaka med *Importera säkerhetskopia*, även på en annan
   telefon. Datumet för senaste kopian visas i adminpanelen, med varning när det tillkommit
   resor sedan dess.
2. **De inskickade PDF:erna** är i praktiken ett arkiv – varje utskick innehåller alla rader för
   perioden och ligger kvar i affärssystemets inkorg.
3. Appen ber webbläsaren om **beständig lagring** (`navigator.storage.persist`), vilket normalt
   beviljas när appen är installerad på hemskärmen och skyddar mot automatisk rensning.

## Vad är inskickat?

Varje resa får ett datum i `sentAt` när den följt med i ett utskick. Det syns på tre ställen:

* månadsraden i listan: *"1 741 km · 2 ej inskickade"*
* en grön bock på raden för resor som är inskickade
* en banner högst upp i resan när du öppnar den, med *Markera som ej inskickad* om du behöver
  skicka om

I *Skicka in* ligger **Ej inskickade** överst i periodlistan och är förvald, så nästa utskick tar
med precis det som saknas – inga dubletter, inget som glöms.

## Adminpanel

Listikonen uppe till vänster öppnar adminpanelen med två delar:

**Dieselpris med historik.** Varje pris gäller från sitt datum tills ett nytt läggs in. Resor som
redan är körda behåller det pris som gällde då – ändrar du priset idag räknas gamla resor inte
om.

**Hela loggen.** Alla resor i en tabell med datum, tid, förare, bil, kund, ordernummer, adresser,
km, milersättning, dieselpris, liter, bränslekostnad, trängselskatt och status (påbörjad,
ej inskickad eller inskickad med datum). Fritextsökning på kund, ordernummer, adress eller
förare, summering överst, och klick på en rad öppnar resan för redigering.
*Kopiera loggen för Excel* lägger hela tabellen på urklipp.

## Statistik

Diagramknappen uppe till höger grupperar avslutade resor per **dag, vecka, månad, kund,
ordernummer eller rutt**, med filter per bil. Varje rad visar antal resor, körsträcka,
dieselåtgång och bränslekostnad. *Kopiera tabellen för Excel* lägger den på urklipp.

Ordernumret är fältet som kopplar en resa till en order, så fraktkostnaden per order går att
följa upp.

## Lås med Face ID

Låset är **på från början**. Appen frågar efter koden i `LOCK_CODE` (`app.js`) varje gång den
startas. Admin → *Lägg till Face ID* registrerar telefonens biometri via WebAuthn, så slipper du
knappa in koden – den finns kvar som reserv. *Ta bort låset* stänger av det helt.

Koden ligger i klartext i källkoden. Repot är publikt, så vem som helst kan läsa den – vilket
spelar mindre roll än det låter, eftersom ingen kommer åt din data via webbadressen ändå.
Behöver koden vara hemlig måste repot bli privat.

**Vad låset skyddar mot:** att någon som får tag i den olåsta telefonen läser journalen.
**Vad det inte skyddar mot:** låset kontrolleras i webbläsaren, utan server som verifierar
signaturen. Den som kan JavaScript kan gå runt det. Datan i sig ligger ändå bara på telefonen –
ingen kan komma åt den via webbadressen.

## Ny version

Höj `CACHE` i `sw.js` och `VER` i `app.js` när du publicerar ändringar, annars kan telefoner
ligga kvar på den cachade versionen.
