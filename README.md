# Körjournal

Mobilapp (PWA) för att registrera resor och skicka in körjournalen som PDF via mejl.
Ingen server, ingen inloggning – all data ligger i telefonen (localStorage).

## Fält per resa

KUND · SYFTE · ORDERNR · VERKSAMHET · DATUM · TID · MÄTARSTÄLLNING START ·
MÄTARSTÄLLNING STOPP · KM · ADRESS START · ADRESS STOPP · TRÄNGSELSKATT · PERSON · REGNR

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
| Förare | EBBA, GEORGE |
| Bilar | **BMW520D** – 25 kr/mil, 0,7 l/mil · **BUDBIL** – ingen milersättning, 1,0 l/mil |
| Verksamhet | FILTER, MUSIK |
| Mottagare | info@airstrategy.se |

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

**Skicka in → Skapa PDF och öppna mejl** bygger en A4-PDF (liggande) för vald period och förare
och öppnar telefonens delningsruta. Välj Outlook/Gmail så följer PDF:en med som bilaga.
Kan telefonen inte dela filer laddas PDF:en ner och mejlet öppnas med mottagaren förifylld –
då bifogas filen manuellt.

Extra: **Kopiera rader för Excel** lägger raderna på urklipp (tabbseparerat) för inklistring
i det gamla arket.

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

1. **Säkerhetskopia** – Inställningar → *Exportera säkerhetskopia (JSON)*. Filen innehåller alla
   resor och inställningar och läses tillbaka med *Importera säkerhetskopia*, även på en annan
   telefon. Datumet för senaste kopian visas i Inställningar, med varning när det tillkommit
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
om. Priset går också att ändra i Inställningar, vilket lägger in det med dagens datum.

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

## Ny version

Höj `CACHE` i `sw.js` och `VER` i `app.js` när du publicerar ändringar, annars kan telefoner
ligga kvar på den cachade versionen.
