# Körjournal

Mobilapp (PWA) för att registrera resor och skicka in körjournalen som PDF via mejl.
Ingen server, ingen inloggning – all data ligger i telefonen (localStorage).

## Fält per resa

KUND · SYFTE · VERKSAMHET · DATUM · MÄTARSTÄLLNING START · MÄTARSTÄLLNING STOPP · KM
· ADRESS START · ADRESS STOPP · TRÄNGSELSKATT · PERSON · REGNR

KM räknas ut automatiskt. Mätarställning start och adress start förifylls från förra resan.
PERSON och REGNR väljs med ett tryck: två förare (Ebba / George) och två bilar (WXE84R plus en
till som fylls i när regnumret är känt). Namn och regnummer ändras i Inställningar, som också
bestämmer vilken förare och bil som är förvald.
DATUM skrivs som ÅÅMMDD i PDF/Excel-exporten, precis som i det befintliga Excel-arket.

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

## Säkerhetskopia

Inställningar → *Exportera säkerhetskopia (JSON)*. Data ligger bara i telefonen, så ta en kopia
innan du byter telefon eller rensar webbläsardata.

## Ny version

Höj `CACHE` i `sw.js` och `VER` i `app.js` när du publicerar ändringar, annars kan telefoner
ligga kvar på den cachade versionen.
