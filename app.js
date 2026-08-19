/* Körjournal – all data ligger lokalt i telefonen (localStorage). */
(function () {
  'use strict';

  var VER = '3.9.0';
  var K_TRIPS = 'kj.trips.v1', K_SET = 'kj.settings.v1';
  var MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
                'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  var DAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];

  var TAB = String.fromCharCode(9), NL = String.fromCharCode(10);
  var $ = function (id) { return document.getElementById(id); };
  var trips = [], settings = {};
  var editId = null;

  /* ---------------- fasta val ----------------
     Föraren ska välja, inte konfigurera. Allt nedan ändras i koden. */
  var DRIVERS = ['EBBA', 'GEORGE'];
  var CARS = [
    { namn: 'BMW520D', nr: 'WXE84R', mil: 25, forb: 0.7 },   // privat bil: ger milersättning
    { namn: 'BUDBIL',  nr: '',       mil: 0,  forb: 1.0 }    // företagsbil: bara loggning
  ];
  var VERKSAMHETER = ['FILTER', 'MUSIK'];
  var DEFAULT_MAIL = 'george@airstrategy.se';
  var LOCK_CODE = '1934';
  var DEFAULT_DIESEL = 20;   // kr/liter, riktvärde tills ett eget pris läggs in

  function carDef(namn) {
    for (var i = 0; i < CARS.length; i++) if (CARS[i].namn === namn) return CARS[i];
    return CARS[0];
  }
  function regnrFor(namn) {
    var egen = (settings.regnrs || {})[namn];
    return up(egen) || carDef(namn).nr || namn;
  }

  /* ---------------- lagring ---------------- */
  function load() {
    try { trips = JSON.parse(localStorage.getItem(K_TRIPS)) || []; } catch (e) { trips = []; }
    try { settings = JSON.parse(localStorage.getItem(K_SET)) || {}; } catch (e) { settings = {}; }
    if (!settings.regnrs) settings.regnrs = {};
    if (DRIVERS.indexOf(settings.person) === -1) settings.person = DRIVERS[0];
    if (!carDef(settings.bil) || settings.bil !== carDef(settings.bil).namn) settings.bil = CARS[0].namn;
    if (!settings.mail || settings.mail === 'info@airstrategy.se') settings.mail = DEFAULT_MAIL;
    if (settings.lock == null) settings.lock = true;   // låst från början
    if (!settings.foretag) settings.foretag = 'AIRFILTER GROUP';
    /* äldre resor sparade bara regnr – knyt dem till rätt bil */
    trips.forEach(function (t) {
      if (t.bil) return;
      t.bil = (t.regnr === 'WXE84R' || !t.regnr) ? CARS[0].namn : CARS[1].namn;
    });
    /* gamla inställningsfält som inte längre används */
    ['cars', 'drivers', 'verk', 'home', 'regs', 'regnr', 'diesel', 'tull'].forEach(function (k) {
      delete settings[k];
    });
    /* dieselpriset är en historik: varje pris gäller från sitt datum */
    if (!settings.dieselHist || !settings.dieselHist.length) {
      /* ett riktvärde så bränslekostnaden räknas från start – ändras i adminpanelen */
      settings.dieselHist = [{ from: '2000-01-01', pris: numOf(settings.diesel) || DEFAULT_DIESEL }];
    }
    settings.dieselHist = settings.dieselHist
      .filter(function (p) { return p && p.from && numOf(p.pris); })
      .sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    saveSettings(); saveTrips();   // så att migreringen ligger kvar
  }
  /* kr per mil – 0 för företagsbilen, som bara loggas */
  function rateFor(bil) { return carDef(bil).mil; }
  /* liter per mil, fast per bil */
  function forbFor(bil) { return carDef(bil).forb; }
  function carNames() { return CARS.map(function (c) { return c.namn; }); }
  /* belopp: 4057.5 → "4 057,50 kr" */
  function kr(v) {
    var p = (Math.round(numOf(v) * 100) / 100).toFixed(2).split('.');
    return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + p[1] + ' kr';
  }
  function mil(km) { return (Math.round(km * 10) / 100).toString().replace('.', ','); }
  /* milersättning för en resa */
  function ersFor(t) {
    var r = rateFor(t.bil);
    return r ? Math.round(numOf(t.km) / 10 * r * 100) / 100 : 0;
  }
  /* uppskattad dieselåtgång och kostnad för en resa */
  function literFor(t) {
    var f = forbFor(t.bil);
    return f ? Math.round(numOf(t.km) / 10 * f * 10) / 10 : 0;
  }
  function prisAt(datum) {
    var h = settings.dieselHist || [], vald = 0;
    for (var i = 0; i < h.length; i++) if (h[i].from <= datum) vald = numOf(h[i].pris);
    if (!vald && h.length) vald = numOf(h[0].pris);   // resor före första priset
    return vald;
  }
  function fuelFor(t) {
    var l = literFor(t), p = prisAt(t.datum || todayISO());
    return (l && p) ? Math.round(l * p * 100) / 100 : 0;
  }
  function dec(v, n) { return (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toString().replace('.', ','); }
  /* segmenterad väljare: renderar knappar och returnerar vald via onPick */
  function segment(el, items, active, onPick) {
    el.innerHTML = '';
    items.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = v === active ? 'on' : '';
      b.textContent = v;
      b.addEventListener('click', function (e) {
        e.preventDefault();
        Array.prototype.forEach.call(el.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        onPick(v);
      });
      el.appendChild(b);
    });
  }
  function saveTrips() { localStorage.setItem(K_TRIPS, JSON.stringify(trips)); }
  function saveSettings() { localStorage.setItem(K_SET, JSON.stringify(settings)); }

  /* ---------------- hjälpare ---------------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(v) { return v < 10 ? '0' + v : '' + v; }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function shiftISO(iso, days) {
    var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function yymmdd(iso) { var p = iso.split('-'); return p[0].slice(2) + p[1] + p[2]; }
  function monthKey(iso) { return iso.slice(0, 7); }
  function monthLabel(key) { return MONTHS[+key.slice(5, 7) - 1] + ' ' + key.slice(0, 4); }
  function weekday(iso) { var p = iso.split('-'); return DAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function numOf(v) { var x = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, '')); return isFinite(x) ? x : 0; }
  function intOf(v) { var x = parseInt(String(v == null ? '' : v).replace(/\D/g, ''), 10); return isFinite(x) ? x : 0; }
  function up(s) { return String(s || '').trim(); }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /* en resa utan stoppvärde är påbörjad men inte avslutad */
  function isOpen(t) { return !t.matStopp; }

  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, ms || 2200);
  }

  /* inskickat: resor som följt med i en utskickad körjournal */
  function markSent(sel) {
    var stamp = todayISO(), ids = {}, i;
    for (i = 0; i < sel.length; i++) ids[sel[i].id] = 1;
    for (i = 0; i < trips.length; i++) if (ids[trips[i].id] && !trips[i].sentAt) trips[i].sentAt = stamp;
    saveTrips(); render();
  }
  function unsent() {
    return trips.filter(function (t) { return !t.sentAt; });
  }

  function sortedTrips() {
    return trips.slice().sort(function (a, b) {
      if (a.datum !== b.datum) return a.datum < b.datum ? 1 : -1;
      return (b.matStart || 0) - (a.matStart || 0);
    });
  }
  function lastTrip() {
    var s = sortedTrips();
    return s.length ? s[0] : null;
  }
  function freqList(key, limit) {
    var c = {}, i;
    for (i = 0; i < trips.length; i++) {
      var v = up(trips[i][key]);
      if (v) c[v] = (c[v] || 0) + 1;
    }
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, limit || 50);
  }
  function addressList(limit) {
    var c = {}, i;
    for (i = 0; i < trips.length; i++) {
      ['adressStart', 'adressStopp'].forEach(function (k) {
        var v = up(trips[i][k]); if (v) c[v] = (c[v] || 0) + 1;
      });
    }
    if (settings.home) c[up(settings.home)] = (c[up(settings.home)] || 0) + 999;
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, limit || 50);
  }
  function fillDatalist(el, arr) {
    el.innerHTML = arr.map(function (v) { return '<option value="' + v.replace(/"/g, '&quot;') + '">'; }).join('');
  }
  function chipRow(el, arr, onPick) {
    arr = arr || [];
    el.innerHTML = '';
    arr.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = v;
      b.addEventListener('click', function (e) { e.preventDefault(); onPick(v, arr.indexOf(v)); });
      el.appendChild(b);
    });
  }

  /* ---------------- lista ---------------- */
  function render() {
    var list = $('tripList'), s = sortedTrips();
    if (!s.length) {
      $('summary').innerHTML = '<div class="big">0<span>km</span></div><div class="meta">Ingen resa registrerad ännu</div>';
      list.innerHTML = '<div class="empty"><b>Tom körjournal</b>Tryck på <b style="display:inline">+ Ny resa</b> för att registrera din första resa.</div>';
      return;
    }
    var thisMonth = monthKey(todayISO()), km = 0, cnt = 0, ers = 0, utlagg = 0;
    trips.forEach(function (t) {
      if (monthKey(t.datum) !== thisMonth) return;
      km += numOf(t.km); cnt++;
      ers += ersFor(t);
      utlagg += numOf(t.trangsel);
    });
    $('summary').innerHTML =
      '<div class="big">' + km + '<span>km</span></div>' +
      '<div class="meta">' + MONTHS[+thisMonth.slice(5, 7) - 1] + ' · ' + cnt + ' resor</div>' +
      (ers || utlagg ? '<div class="pay">' + kr(ers + utlagg) + '<span>att ersätta</span></div>' : '') +
      '<button type="button" id="summarySend" class="btn btn-primary send-top">Skicka in körjournal</button>';
    $('summarySend').addEventListener('click', openSend);

    var html = '', curM = null;
    s.forEach(function (t) {
      var mk = monthKey(t.datum);
      if (mk !== curM) {
        curM = mk;
        var mkm = 0, mc = 0, mej = 0;
        trips.forEach(function (x) {
          if (monthKey(x.datum) !== mk) return;
          mkm += numOf(x.km); mc++; if (!x.sentAt) mej++;
        });
        html += '<div class="month-head"><span>' + monthLabel(mk) + '</span>' +
                '<span class="tot">' + mkm + ' km' +
                (mej ? ' · <em>' + mej + ' ej inskickade</em>' : ' · allt inskickat') + '</span></div>';
      }
      var d = t.datum.split('-'), oppen = isOpen(t);
      html += '<button class="trip' + (oppen ? ' open' : '') + '" data-id="' + t.id + '">' +
        '<span class="d"><b>' + d[2] + '</b><i>' + weekday(t.datum) + '</i></span>' +
        '<span class="mid"><b>' + esc(t.kund || (oppen ? 'Påbörjad resa' : '—')) + '</b>' +
        '<span>' + (t.tidStart ? t.tidStart + ' · ' : '') + esc(t.adressStart || '') +
        (oppen ? ' → …' : ' → ' + esc(t.adressStopp || '')) + '</span></span>' +
        '<span class="km">' + (oppen ? '<i class="go">Avsluta</i>' : numOf(t.km) + ' <i>km</i>') +
        (t.sentAt ? '<i class="flag" title="Inskickad ' + t.sentAt + '">✓ inskickad</i>' : '') +
        '</span></button>';
    });
    list.innerHTML = html;
    Array.prototype.forEach.call(list.querySelectorAll('.trip'), function (b) {
      b.addEventListener('click', function () { openTrip(b.getAttribute('data-id')); });
    });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------- sheets ---------------- */
  function open(el) { el.hidden = false; document.body.style.overflow = 'hidden'; }
  function close(el) { el.hidden = true; document.body.style.overflow = ''; }

  /* ---------------- resa ---------------- */
  function openTrip(id, preset) {
    editId = id || null;
    var t = id ? trips.filter(function (x) { return x.id === id; })[0] : null;
    var prev = lastTrip();

    if (!t) {
      t = preset || {};
      if (!t.datum) t.datum = todayISO();
      if (t.matStart == null) t.matStart = prev ? prev.matStopp : '';
      if (t.adressStart == null) t.adressStart = prev ? prev.adressStopp : '';
      if (!t.verksamhet) t.verksamhet = VERKSAMHETER[0];
    }

    $('tripTitle').textContent = id ? 'Ändra resa' : 'Ny resa';
    $('btnDelete').hidden = !id;

    $('fDatum').value = t.datum || todayISO();
    $('fKund').value = t.kund || '';
    $('fSyfte').value = t.syfte || '';
    $('fAdrStart').value = t.adressStart || '';
    $('fAdrStopp').value = t.adressStopp || '';
    $('fMatStart').value = t.matStart || '';
    $('fMatStopp').value = t.matStopp || '';
    if (t.sentAt) {
      $('sentBar').hidden = false;
      $('sentBar').innerHTML = '<span>Inskickad ' + t.sentAt + '</span>' +
        '<button type="button" id="undoSent">Markera som ej inskickad</button>';
      $('undoSent').onclick = function (e) {
        e.preventDefault();
        for (var i = 0; i < trips.length; i++) if (trips[i].id === id) delete trips[i].sentAt;
        saveTrips(); render();
        $('sentBar').hidden = true;
        toast('Markerad som ej inskickad');
      };
    } else $('sentBar').hidden = true;

    delete $('sheetTrip').dataset.startLat;
    delete $('sheetTrip').dataset.stopLat;
    $('calcHint').textContent = '';
    $('startHint').textContent = (!id && prev && t.matStart && t.matStart === prev.matStopp)
      ? 'Ifylld från förra resan, som slutade på ' + prev.matStopp + '.'
      : 'Läs av mätaren innan du kör.';
    $('fTidStart').value = t.tidStart || (id ? '' : nowHM());
    $('fTidStopp').value = t.tidStopp || '';
    $('fOrdernr').value = t.ordernr || '';
    $('fKontakt').value = t.kontakt || '';
    $('fTrangselBelopp').value = '';
    setPassager(t.trangselPassager && t.trangselPassager.length
      ? t.trangselPassager.slice()
      : (numOf(t.trangsel) ? [numOf(t.trangsel)] : []));

    var person = DRIVERS.indexOf(t.person) >= 0 ? t.person : settings.person;
    var bil = carNames().indexOf(t.bil) >= 0 ? t.bil : settings.bil;
    $('sheetTrip').dataset.person = person;
    $('sheetTrip').dataset.bil = bil;

    segment($('whoSeg'), DRIVERS, person, function (v) { $('sheetTrip').dataset.person = v; });
    segment($('carSeg'), carNames(), bil, function (v) { $('sheetTrip').dataset.bil = v; calcKm(); });
    segment($('verkSeg'), VERKSAMHETER,
      VERKSAMHETER.indexOf(t.verksamhet) >= 0 ? t.verksamhet : VERKSAMHETER[0],
      function (v) { $('sheetTrip').dataset.verksamhet = v; });
    $('sheetTrip').dataset.verksamhet = VERKSAMHETER.indexOf(t.verksamhet) >= 0 ? t.verksamhet : VERKSAMHETER[0];

    fillDatalist($('dlKund'), freqList('kund'));
    fillDatalist($('dlSyfte'), freqList('syfte'));
    fillDatalist($('dlAdrStart'), addressList());
    fillDatalist($('dlAdrStopp'), addressList());

    chipRow($('kundChips'), freqList('kund', 4), function (v) { $('fKund').value = v; });
    chipRow($('syfteChips'), freqList('syfte', 4), function (v) { $('fSyfte').value = v; });
    fillDatalist($('dlKontakt'), freqList('kontakt'));
    chipRow($('kontaktChips'), freqList('kontakt', 4), function (v) { $('fKontakt').value = v; });
    fillDatalist($('dlOrder'), freqList('ordernr'));
    chipRow($('orderChips'), freqList('ordernr', 4), function (v) { $('fOrdernr').value = v; });
    var adr = addressList(4);
    chipRow($('fromChips'), adr, function (v) { $('fAdrStart').value = v; });
    chipRow($('toChips'), adr, function (v) { $('fAdrStopp').value = v; calcKm(); });

    calcKm();
    open($('sheetTrip'));
    $('sheetTrip').querySelector('.sheet-body').scrollTop = 0;
  }

  /* ---------------- karta: adressförslag och GPS ----------------
     Använder OpenStreetMap/Nominatim. Kräver nät – utan täckning
     funkar fälten precis som förut, med historiken som förslag. */
  var GEO = 'https://nominatim.openstreetmap.org/';

  function geoLabel(a) {
    if (!a) return '';
    var gata = [a.road, a.house_number].filter(Boolean).join(' ');
    var ort = a.city || a.town || a.village || a.hamlet || a.municipality || '';
    var namn = a.amenity || a.shop || a.office || a.building || '';
    var del = [gata || namn, ort].filter(Boolean);
    return del.join(', ') || ort;
  }

  /* skriv-förslag: slår upp adressen medan man skriver */
  function geoSuggest(input, dl, historyFn) {
    var timer = null, last = '';
    input.addEventListener('input', function () {
      var q = up(input.value);
      if (q.length < 4 || q === last) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        last = q;
        fetch(GEO + 'search?format=jsonv2&addressdetails=1&limit=6&countrycodes=se&q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (list) {
            if (up(input.value) !== q) return;          // användaren skrev vidare
            var hits = (list || []).map(function (o) { return geoLabel(o.address); }).filter(Boolean);
            var seen = {}, all = historyFn().concat(hits).filter(function (v) {
              if (seen[v]) return false; seen[v] = 1; return true;
            });
            fillDatalist(dl, all);
          })
          .catch(function () { /* offline – historiken räcker */ });
      }, 700);
    });
  }

  /* GPS: hämtar position och översätter till gatuadress */
  function useMyPosition(btn, input, mark) {
    if (!navigator.geolocation) { toast('Telefonen delar inte plats'); return; }
    btn.classList.add('busy');
    var done = function (msg) { btn.classList.remove('busy'); if (msg) toast(msg, 3000); };
    navigator.geolocation.getCurrentPosition(function (pos) {
      var c = pos.coords;
      if (mark) {                                   // spara punkten för körvägsberäkningen
        $('sheetTrip').dataset[mark + 'Lat'] = c.latitude;
        $('sheetTrip').dataset[mark + 'Lon'] = c.longitude;
      }
      fetch(GEO + 'reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' + c.latitude + '&lon=' + c.longitude)
        .then(function (r) { return r.json(); })
        .then(function (o) {
          var adr = geoLabel(o && o.address);
          if (!adr) { done('Hittade ingen adress här'); return; }
          input.value = adr;
          done('Plats hämtad · ca ' + Math.round(c.accuracy) + ' m noggrannhet');
        })
        .catch(function () { done('Ingen nätverkskontakt – skriv adressen'); });
    }, function (err) {
      done(err && err.code === 1 ? 'Appen får inte använda din plats' : 'Kunde inte hitta din plats');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  /* ---------------- körväg från kartan ----------------
     Uppskattar körsträckan mellan start och stopp och föreslår
     en mätarställning. Föraren måste stämma av mot mätaren. */
  var OSRM = 'https://router.project-osrm.org/route/v1/driving/';
  var geoCache = {};

  /* adresstext → koordinat */
  function geoPoint(text) {
    text = up(text);
    if (!text) return Promise.resolve(null);
    if (geoCache[text]) return Promise.resolve(geoCache[text]);
    return fetch(GEO + 'search?format=jsonv2&limit=1&countrycodes=se&q=' + encodeURIComponent(text))
      .then(function (r) { return r.json(); })
      .then(function (l) {
        if (!l || !l.length) return null;
        geoCache[text] = { lat: +l[0].lat, lon: +l[0].lon };
        return geoCache[text];
      })
      .catch(function () { return null; });
  }

  /* punkt för ett fält: GPS-koordinaten i första hand, annars adresstexten */
  function pointFor(mark, input) {
    var d = $('sheetTrip').dataset;
    if (d[mark + 'Lat']) return Promise.resolve({ lat: +d[mark + 'Lat'], lon: +d[mark + 'Lon'] });
    return geoPoint(input.value);
  }

  function routeKm(a, b) {
    return fetch(OSRM + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=false')
      .then(function (r) { return r.json(); })
      .then(function (o) {
        if (!o || o.code !== 'Ok' || !o.routes || !o.routes.length) return null;
        return Math.round(o.routes[0].distance / 1000);
      })
      .catch(function () { return null; });
  }

  function suggestFromMap() {
    var btn = $('btnCalcKm'), hint = $('calcHint');
    if (!up($('fAdrStart').value) || !up($('fAdrStopp').value)) {
      hint.textContent = 'Fyll i både start- och slutadress först.';
      return;
    }
    btn.classList.add('busy');
    hint.textContent = 'Hämtar körvägen…';
    Promise.all([pointFor('start', $('fAdrStart')), pointFor('stop', $('fAdrStopp'))])
      .then(function (p) {
        if (!p[0] || !p[1]) { throw new Error('adress'); }
        return routeKm(p[0], p[1]);
      })
      .then(function (km) {
        btn.classList.remove('busy');
        if (!km) { hint.textContent = 'Kartan hittade ingen körväg. Skriv in mätarställningen.'; return; }
        var start = intOf($('fMatStart').value);
        if (start) {
          $('fMatStopp').value = start + km;
          calcKm();
          hint.textContent = 'Förslag: ' + km + ' km körväg enligt kartan. Stäm av mot mätaren.';
        } else {
          hint.textContent = 'Körväg enligt kartan: ' + km + ' km. Fyll i mätarställning vid start först.';
        }
      })
      .catch(function () {
        btn.classList.remove('busy');
        hint.textContent = 'Kunde inte räkna ut sträckan – kontrollera adresserna eller nätet.';
      });
  }

  /* varje passage läggs till för sig, summan räknas fram av appen */
  function passager() {
    try { return JSON.parse($('sheetTrip').dataset.passager || '[]'); } catch (e) { return []; }
  }
  function setPassager(list) {
    $('sheetTrip').dataset.passager = JSON.stringify(list);
    var sum = list.reduce(function (a, b) { return a + numOf(b); }, 0);
    $('fTrangsel').value = sum || '';
    $('trangselSum').innerHTML = '<b>' + dec(sum, 2) + '</b> kr' +
      (list.length ? ' · ' + list.length + (list.length === 1 ? ' passage' : ' passager') : '');
    chipRow($('trangselList'), list.map(function (v) { return dec(v, 2) + ' kr'; }), function (v, i) {
      var kvar = passager(); kvar.splice(i, 1); setPassager(kvar);
    });
    Array.prototype.forEach.call($('trangselList').children, function (c) { c.classList.add('pass'); });
  }
  function addPassage() {
    var v = numOf($('fTrangselBelopp').value);
    if (!v) { toast('Skriv beloppet för passagen först'); $('fTrangselBelopp').focus(); return; }
    var list = passager(); list.push(v); setPassager(list);
    $('fTrangselBelopp').value = '';
  }

  function calcKm() {
    var a = intOf($('fMatStart').value), b = intOf($('fMatStopp').value);
    var out = $('kmOut'), hint = $('kmHint');
    showFuel(0);
    if (!a && !b) { out.className = 'km-out'; out.innerHTML = '<b>0</b> km'; hint.textContent = 'Fyll i mätarställning start och stopp.'; return; }
    if (b && a && b < a) { out.className = 'km-out bad'; out.innerHTML = '<b>' + (b - a) + '</b> km'; hint.textContent = 'Stoppvärdet är lägre än startvärdet.'; return; }
    var km = (a && b) ? b - a : 0;
    out.className = 'km-out'; out.innerHTML = '<b>' + km + '</b> km';
    hint.textContent = km ? '' : 'Fyll i mätarställning stopp.';
    showFuel(km);
  }
  /* uppskattad dieselkostnad för resan som fylls i just nu */
  function showFuel(km) {
    var bil = $('sheetTrip').dataset.bil, f = forbFor(bil), p = prisAt($('fDatum').value || todayISO());
    if (!km || !f || !p) { $('fuelOut').textContent = ''; return; }
    var liter = Math.round(km / 10 * f * 10) / 10;
    $('fuelOut').textContent = 'Bränsle ca ' + dec(liter, 1) + ' l · ' + kr(liter * p) + ' (' + bil + ')';
  }

  function readForm() {
    return {
      datum: $('fDatum').value || todayISO(),
      kund: up($('fKund').value),
      syfte: up($('fSyfte').value),
      verksamhet: $('sheetTrip').dataset.verksamhet || VERKSAMHETER[0],
      adressStart: up($('fAdrStart').value),
      adressStopp: up($('fAdrStopp').value),
      matStart: intOf($('fMatStart').value),
      matStopp: intOf($('fMatStopp').value),
      kontakt: up($('fKontakt').value),
      trangsel: numOf($('fTrangsel').value) || '',
      trangselPassager: passager(),
      tidStart: $('fTidStart').value || '',
      tidStopp: $('fTidStopp').value || '',
      ordernr: up($('fOrdernr').value),
      person: $('sheetTrip').dataset.person || settings.person,
      bil: $('sheetTrip').dataset.bil || settings.bil,
      regnr: regnrFor($('sheetTrip').dataset.bil || settings.bil)
    };
  }

  function saveTrip(thenReturn) {
    var f = readForm();
    if (!f.matStart) { toast('Fyll i mätarställning vid start'); $('fMatStart').focus(); return; }
    if (!f.adressStart) { toast('Fyll i var du startar'); $('fAdrStart').focus(); return; }

    var pagaende = !f.matStopp;
    if (pagaende) {
      f.km = '';
    } else {
      if (f.matStopp < f.matStart) { toast('Stopp måste vara högre än start'); $('fMatStopp').focus(); return; }
      if (!f.kund) { toast('Fyll i kund'); $('fKund').focus(); return; }
      if (!f.adressStopp) { toast('Fyll i var du är framme'); $('fAdrStopp').focus(); return; }
      if (!f.tidStopp) f.tidStopp = nowHM();
      f.km = f.matStopp - f.matStart;
    }

    if (editId) {
      for (var i = 0; i < trips.length; i++) if (trips[i].id === editId) {
        f.id = editId; f.createdAt = trips[i].createdAt; trips[i] = f;
      }
    } else {
      f.id = uid(); f.createdAt = new Date().toISOString();
      trips.push(f);
    }
    settings.person = f.person; settings.bil = f.bil; saveSettings();
    saveTrips(); render();

    if (thenReturn) {
      toast('Sparad – fyll i returresan');
      openTrip(null, {
        datum: f.datum,
        kund: f.kund,
        syfte: /hemresa/i.test(f.syfte) ? f.syfte : (f.syfte ? f.syfte + ' HEMRESA' : 'HEMRESA'),
        verksamhet: f.verksamhet,
        adressStart: f.adressStopp,
        adressStopp: f.adressStart,
        matStart: f.matStopp
      });
    } else {
      close($('sheetTrip'));
      toast(pagaende ? 'Resan är påbörjad – avsluta den när du är framme' : 'Resa sparad · ' + f.km + ' km',
            pagaende ? 3500 : 2200);
    }
  }

  /* ---------------- lås med Face ID ----------------
     WebAuthn mot telefonens egen biometri. Låset sitter i appen och
     kontrolleras lokalt – det stoppar den som får tag i telefonen, inte
     någon som läser koden. Reservkoden behövs när biometrin inte svarar. */
  function rnd(n) {
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a;
  }
  function b64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function bioSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
  }

  function lockCreate() {
    return navigator.credentials.create({
      publicKey: {
        challenge: rnd(32),
        rp: { name: 'AIRFILTER GROUP - KÖRJOURNAL' },
        user: { id: rnd(16), name: settings.person || 'forare', displayName: settings.person || 'Förare' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 30000
      }
    }).then(function (cred) { return b64(cred.rawId); });
  }
  function lockVerify() {
    return navigator.credentials.get({
      publicKey: {
        challenge: rnd(32),
        allowCredentials: settings.lockId ? [{ type: 'public-key', id: unb64(settings.lockId) }] : [],
        userVerification: 'required',
        timeout: 60000
      }
    });
  }

  function showLock() {
    $('lockScreen').hidden = false;
    document.body.style.overflow = 'hidden';
    $('lockCodeBox').hidden = true;
    $('lockBio').hidden = !settings.lockId;
    $('lockCodeBox').hidden = !!settings.lockId;
    $('lockUseCode').hidden = !settings.lockId;
    $('lockMsg').textContent = settings.lockId ? 'Lås upp för att fortsätta' : 'Ange koden för att fortsätta';
    if (settings.lockId) setTimeout(tryBio, 300);
  }
  function hideLock() {
    $('lockScreen').hidden = true;
    document.body.style.overflow = '';
  }
  function tryBio() {
    lockVerify().then(hideLock).catch(function (err) {
      var namn = err && err.name;
      $('lockMsg').textContent = (namn === 'NotAllowedError' || namn === 'InvalidStateError')
        ? 'Ingen nyckel för den här enheten. Använd reservkoden och slå på låset igen under Admin.'
        : 'Face ID svarade inte. Försök igen eller använd reservkoden.';
    });
  }

  /* Låset slås på direkt med koden. Face ID läggs till efteråt om
     telefonen svarar – annars står låset kvar med bara kod. */
  function enableLock() {
    settings.lock = true;
    saveSettings(); renderLockState();
    if (!bioSupported()) {
      toast('Låst med kod. Enheten stödjer inte Face ID.', 4500);
      return;
    }
    toast('Godkänn med Face ID…', 5000);
    lockCreate().then(function (id) {
      settings.lockId = id;
      saveSettings(); renderLockState();
      toast('Face ID tillagt', 3000);
    }).catch(function () {
      renderLockState();
      toast('Face ID lades inte till – koden gäller', 4500);
    });
  }
  function disableLock() {
    delete settings.lockId;
    settings.lock = false;
    saveSettings(); renderLockState();
    toast('Låset avstängt');
  }
  function lockOn() { return settings.lock !== false; }
  function renderLockState() {
    var pa = lockOn(), bio = !!settings.lockId;
    $('lockState').textContent = !pa
      ? 'Appen är olåst. Vem som helst som har telefonen kommer åt journalen.'
      : bio ? 'Låst med Face ID, med koden som reserv.'
            : 'Låst med kod. Lägg till Face ID så slipper du knappa in den.';
    $('btnLockOn').hidden = pa && bio;
    $('btnLockOn').textContent = pa ? 'Lägg till Face ID' : 'Lås appen';
    $('btnLockOff').hidden = !pa;
  }

  /* ---------------- konfiguration (adminpanelen) ---------------- */
  function renderBackupInfo() {
    var bi = $('backupInfo'), sedan = settings.backupAt
      ? trips.filter(function (t) { return (t.createdAt || '').slice(0, 10) > settings.backupAt; }).length : trips.length;
    bi.className = 'backup' + (sedan > 5 ? ' warn' : '');
    bi.textContent = settings.backupAt
      ? 'Senaste säkerhetskopia ' + settings.backupAt + (sedan ? ' · ' + sedan + ' resor har tillkommit sedan dess' : ' · allt är säkrat')
      : 'Ingen säkerhetskopia tagen ännu';
    $('verInfo').textContent = 'Körjournal ' + VER + ' · ' + trips.length + ' resor sparade i den här telefonen';
  }

  /* bilarna är fasta; bara regnumret går att fylla i */
  function renderBilar() {
    $('bilList').innerHTML = CARS.map(function (c) {
      var nr = regnrFor(c.namn);
      return '<div class="bil-row"><div><b>' + c.namn + '</b><span>' +
        (c.mil ? c.mil + ' kr/mil · ' : 'ingen milersättning · ') + dec(c.forb, 2) + ' l/mil</span></div>' +
        '<input class="inp" data-bil="' + c.namn + '" value="' + esc(nr === c.namn ? '' : nr) +
        '" placeholder="regnr" autocapitalize="characters"></div>';
    }).join('');
    Array.prototype.forEach.call($('bilList').querySelectorAll('input'), function (inp) {
      inp.addEventListener('change', function () {
        settings.regnrs[inp.getAttribute('data-bil')] = up(inp.value).toUpperCase();
        saveSettings(); renderAdmin(); render();
        toast('Regnummer sparat');
      });
    });
    $('adminMail').value = settings.mail || DEFAULT_MAIL;
  }

  /* ---------------- skicka in ---------------- */
  function openSend() {
    var keys = {}, i;
    for (i = 0; i < trips.length; i++) keys[monthKey(trips[i].datum)] = 1;
    var months = Object.keys(keys).sort().reverse();
    if (!months.length) { toast('Inga resor att skicka in'); return; }

    var kvar = unsent().length;
    $('sendPeriod').innerHTML =
      (kvar ? '<option value="EJ">Ej inskickade (' + kvar + ' resor)</option>' : '') +
      months.map(function (m) {
        return '<option value="' + m + '">' + monthLabel(m) + '</option>';
      }).join('') + '<option value="ALLA">Alla resor</option>';
    var cur = monthKey(todayISO());
    $('sendPeriod').value = kvar ? 'EJ' : (months.indexOf(cur) >= 0 ? cur : months[0]);

    var pers = {};
    trips.forEach(function (t) { if (t.person) pers[t.person] = 1; });
    var plist = Object.keys(pers).sort();
    $('sendPerson').innerHTML = '<option value="ALLA">Alla förare</option>' +
      plist.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('');
    if (settings.person && plist.indexOf(settings.person) >= 0) $('sendPerson').value = settings.person;

    $('mailToLabel').textContent = settings.mail || 'Ingen mottagare inställd';
    updateRecap();
    open($('sheetSend'));
  }

  function selection() {
    var per = $('sendPeriod').value, pers = $('sendPerson').value;
    return trips.filter(function (t) {
      if (isOpen(t)) return false;
      if (per === 'EJ') { if (t.sentAt) return false; }
      else if (per !== 'ALLA' && monthKey(t.datum) !== per) return false;
      if (pers !== 'ALLA' && t.person !== pers) return false;
      return true;
    }).sort(function (a, b) {
      if (a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
      return (a.matStart || 0) - (b.matStart || 0);
    });
  }

  /* sammanställning i tre delar: milersättning, utlägg och bränsle för bokföringen */
  function summaryLines(sel) {
    var byCar = {}, order = [], tr = 0, i;
    for (i = 0; i < sel.length; i++) {
      var t = sel[i], nr = t.bil || '—';
      if (byCar[nr] == null) { byCar[nr] = 0; order.push(nr); }
      byCar[nr] += numOf(t.km);
      tr += numOf(t.trangsel);
    }

    var lines = [], totErs = 0, utlagg = tr;

    /* milersättning – bara bilar med kr/mil */
    var medErs = order.filter(function (nr) { return rateFor(nr) > 0; });
    if (medErs.length) {
      lines.push({ head: 'Milersättning' });
      medErs.forEach(function (nr) {
        var km = byCar[nr], rate = rateFor(nr), belopp = Math.round(km / 10 * rate * 100) / 100;
        totErs += belopp;
        lines.push({ label: nr + ' (' + regnrFor(nr) + ') - ' + km + ' km, ' + mil(km) + ' mil x ' + rate + ' kr/mil', value: kr(belopp) });
      });
    }
    var utanErs = order.filter(function (nr) { return !rateFor(nr); });
    utanErs.forEach(function (nr) {
      lines.push({ note: nr + ' - ' + byCar[nr] + ' km, företagsbil utan milersättning' });
    });

    /* utlägg – redovisas var för sig men ingår i summan */
    if (utlagg) {
      lines.push({ head: 'Utlägg' });
      lines.push({ label: 'Trängselskatt', value: kr(tr) });
    }

    lines.push({ rule: true });
    lines.push({ label: 'Att ersätta', value: kr(totErs + utlagg), bold: true });

    /* bränsle – bokföring, ingen ersättning */
    var perCar = {}, totL = 0, totKost = 0, prisSet = {};
    sel.forEach(function (t) {
      var l = literFor(t), k = fuelFor(t);
      if (!l) return;
      var nr = t.bil || '—';
      if (!perCar[nr]) perCar[nr] = { liter: 0, kost: 0 };
      perCar[nr].liter += l; perCar[nr].kost += k;
      totL += l; totKost += k;
      prisSet[prisAt(t.datum)] = 1;
    });
    var fuelCars = Object.keys(perCar);
    if (fuelCars.length) {
      lines.push({ head: 'Beräknad bränslekostnad (bokföring)' });
      fuelCars.forEach(function (nr) {
        lines.push({
          label: nr + ' - ' + dec(perCar[nr].liter, 1) + ' l (' + dec(forbFor(nr), 2) + ' l/mil)',
          value: kr(perCar[nr].kost)
        });
      });
      if (fuelCars.length > 1) {
        lines.push({ label: 'Summa bränsle ' + dec(totL, 1) + ' l', value: kr(totKost), sub: true });
      }
      var priser = Object.keys(prisSet);
      lines.push({ note: priser.length === 1
        ? 'Uppskattning på ' + kr(numOf(priser[0])) + '/liter diesel. Ingår inte i ersättningen.'
        : 'Uppskattning på dieselpriset som gällde vid varje resa. Ingår inte i ersättningen.' });
    }
    return lines;
  }

  function updateRecap() {
    var sel = selection(), km = 0, i;
    for (i = 0; i < sel.length; i++) km += numOf(sel[i].km);
    var lines = summaryLines(sel);
    var html =
      '<div class="row"><span>Period</span><b>' + esc(periodLabel()) + '</b></div>' +
      '<div class="row"><span>Förare</span><b>' + esc($('sendPerson').value === 'ALLA' ? 'Alla' : $('sendPerson').value) + '</b></div>' +
      '<div class="row"><span>Antal resor</span><b>' + sel.length + '</b></div>' +
      '<div class="row"><span>Körsträcka</span><b>' + km + ' km</b></div>';
    if (sel.length) {
      lines.forEach(function (l) {
        if (l.rule) return;
        if (l.head) { html += '<div class="head">' + esc(l.head) + '</div>'; return; }
        if (l.note) { html += '<div class="note">' + esc(l.note) + '</div>'; return; }
        html += '<div class="row' + (l.bold ? ' total' : l.sub ? ' sub' : '') + '">' +
                '<span>' + esc(l.label) + '</span><b>' + esc(l.value) + '</b></div>';
      });
    }
    $('sendRecap').innerHTML = html;
    $('btnMakePdf').disabled = !sel.length;
  }
  function periodLabel() {
    var p = $('sendPeriod').value;
    return p === 'ALLA' ? 'Alla resor' : p === 'EJ' ? 'Ej inskickade resor' : monthLabel(p);
  }

  function pdfRows(sel) {
    return sel.map(function (t) {
      return {
        kund: t.kund, kontakt: t.kontakt || '', syfte: t.syfte, verksamhet: t.verksamhet,
        datum: yymmdd(t.datum),
        matStart: String(t.matStart || ''), matStopp: String(t.matStopp || ''),
        km: String(numOf(t.km)),
        adressStart: t.adressStart, adressStopp: t.adressStopp,
        tid: (t.tidStart || '') + (t.tidStopp ? '-' + t.tidStopp : ''),
        ordernr: t.ordernr || '',
        trangsel: t.trangsel ? KJPdf.fmtKr(numOf(t.trangsel)) : '',
        bransle: fuelFor(t) ? KJPdf.fmtKr(Math.round(fuelFor(t))) : '',
        person: t.person, regnr: t.regnr,
        _km: numOf(t.km), _trangsel: numOf(t.trangsel), _bransle: fuelFor(t)
      };
    });
  }

  function buildPdfBlob() {
    var sel = selection();
    if (!sel.length) return null;
    var pers = $('sendPerson').value === 'ALLA' ? 'Alla förare' : $('sendPerson').value;
    var regs = {}; sel.forEach(function (t) { if (t.bil) regs[t.bil + ' ' + regnrFor(t.bil)] = 1; });
    var per = $('sendPeriod').value;
    var fname = 'KORJOURNAL ' +
      (per === 'ALLA' ? 'alla resor' : per === 'EJ' ? todayISO() : per) + ' ' +
      (pers.replace(/[^A-Za-z0-9ÅÄÖåäö ]+/g, '') || 'forare') + '.pdf';
    var bytes = KJPdf.build(pdfRows(sel), {
      subtitle: pers + '  ·  ' + Object.keys(regs).join(', ') + '  ·  ' + periodLabel(),
      foretag: settings.foretag || '',
      skapad: todayISO(),
      footer: fname,
      summary: summaryLines(sel)
    });
    return { blob: new Blob([bytes], { type: 'application/pdf' }), name: fname, sel: sel, pers: pers };
  }

  function mailBody(r) {
    var km = 0; r.sel.forEach(function (t) { km += numOf(t.km); });
    var sum = '';
    summaryLines(r.sel).forEach(function (l) {
      if (l.rule) return;
      if (l.head) { sum += '\n' + l.head.toUpperCase() + '\n'; return; }
      if (l.note) { sum += l.note + '\n'; return; }
      sum += l.label + ': ' + l.value + '\n';
    });
    return 'Till: ' + (settings.mail || DEFAULT_MAIL) + '\n\n' +
           'Hej,\n\nHär kommer körjournal för ' + periodLabel().toLowerCase() + '.\n' +
           'Förare: ' + r.pers + '\n' +
           'Antal resor: ' + r.sel.length + '\n' +
           'Körsträcka: ' + km + ' km\n\n' +
           sum + '\n' +
           'Körjournalen är bifogad som PDF.\n';
  }

  function sendPdf() {
    var r = buildPdfBlob();
    if (!r) return;
    var subject = 'KÖRJOURNAL';
    var body = mailBody(r);

    var file = null;
    try { file = new File([r.blob], r.name, { type: 'application/pdf' }); } catch (e) { file = null; }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: subject, text: body })
        .then(function () { markSent(r.sel); toast('Skickad · ' + r.sel.length + ' resor bockade av'); })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          fallback(r, subject, body);
        });
    } else {
      fallback(r, subject, body);
    }
  }

  /* öppnar mejlappen med mottagare och ämne redan ifyllda */
  function openMail(bodyText) {
    window.location.href = 'mailto:' + encodeURIComponent(settings.mail || DEFAULT_MAIL) +
      '?subject=' + encodeURIComponent('KÖRJOURNAL') +
      '&body=' + encodeURIComponent(bodyText || '');
  }

  function fallback(r, subject, body) {
    downloadBlob(r.blob, r.name);
    markSent(r.sel);
    toast('PDF sparad – bifoga den i mejlet', 4000);
    setTimeout(function () {
      openMail(body + '\n(Bifoga filen ' + r.name + ' från Nedladdningar.)');
    }, 900);
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  function tsv() {
    var head = ['KUND', 'KONTAKT', 'SYFTE', 'ORDERNR', 'VERKSAMHET', 'DATUM', 'TID', 'MÄTARSTÄLLNING START',
                'MÄTARSTÄLLNING STOPP', 'KM', 'ADRESS START', 'ADRESS STOPP', 'TRÄNGSELSKATT',
                'BRÄNSLE CA', 'PERSON', 'REGNR'];
    var lines = [head.join('\t')];
    pdfRows(selection()).forEach(function (r) {
      lines.push([r.kund, r.kontakt, r.syfte, r.ordernr, r.verksamhet, r.datum, r.tid, r.matStart, r.matStopp, r.km,
                  r.adressStart, r.adressStopp, r.trangsel, r.bransle, r.person, r.regnr].join('\t'));
    });
    return lines.join('\n');
  }

  function copyText(txt, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast(msg); }, function () { legacyCopy(txt, msg); });
    } else legacyCopy(txt, msg);
  }
  function legacyCopy(txt, msg) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(msg); } catch (e) { toast('Kunde inte kopiera'); }
    ta.remove();
  }

  /* ---------------- adminpanel ----------------
     Prishistorik och en fullständig logg över alla resor med kostnader. */
  function addPris(from, pris) {
    settings.dieselHist = (settings.dieselHist || []).filter(function (p) { return p.from !== from; });
    settings.dieselHist.push({ from: from, pris: numOf(pris) });
    settings.dieselHist.sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    saveSettings();
  }

  function renderPris() {
    var h = settings.dieselHist || [], el = $('prisList');
    if (!h.length) { el.innerHTML = '<div class="hint">Inget dieselpris inlagt ännu.</div>'; return; }
    el.innerHTML = h.slice().reverse().map(function (p, i) {
      var galler = i === 0 ? 'gäller nu' : 'till ' + h[h.length - i].from;
      return '<div class="pris-row"><div><b>' + kr(p.pris) + '/l</b>' +
             '<span>från ' + p.from + ' · ' + galler + '</span></div>' +
             '<button type="button" data-pris="' + p.from + '">Ta bort</button></div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        var d = b.getAttribute('data-pris');
        settings.dieselHist = settings.dieselHist.filter(function (p) { return p.from !== d; });
        saveSettings(); renderPris(); renderAdmin(); render();
        toast('Priset borttaget');
      });
    });
  }

  /* alla resor, nyast först, filtrerade på fritext */
  function adminRows() {
    var q = up($('adminSok').value).toLowerCase();
    return sortedTrips().filter(function (t) {
      if (!q) return true;
      return [t.kund, t.kontakt, t.syfte, t.ordernr, t.adressStart, t.adressStopp, t.person, t.regnr, t.datum]
        .join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  var ADMIN_COLS = [
    { t: 'Datum', v: function (t) { return t.datum; } },
    { t: 'Tid', v: function (t) { return (t.tidStart || '') + (t.tidStopp ? '-' + t.tidStopp : ''); } },
    { t: 'Förare', v: function (t) { return t.person || ''; } },
    { t: 'Bil', v: function (t) { return t.bil || ''; } },
    { t: 'Regnr', v: function (t) { return t.regnr || ''; } },
    { t: 'Kund', v: function (t) { return t.kund || ''; } },
    { t: 'Kontakt', v: function (t) { return t.kontakt || ''; } },
    { t: 'Ordernr', v: function (t) { return t.ordernr || ''; } },
    { t: 'Från', v: function (t) { return t.adressStart || ''; } },
    { t: 'Till', v: function (t) { return t.adressStopp || ''; } },
    { t: 'Km', v: function (t) { return numOf(t.km) || ''; }, n: 1 },
    { t: 'Milersättning', v: function (t) { return ersFor(t) ? dec(ersFor(t), 2) : ''; }, n: 1 },
    { t: 'Diesel kr/l', v: function (t) { return prisAt(t.datum) ? dec(prisAt(t.datum), 2) : ''; }, n: 1 },
    { t: 'Liter', v: function (t) { return literFor(t) ? dec(literFor(t), 1) : ''; }, n: 1 },
    { t: 'Bränsle', v: function (t) { return fuelFor(t) ? dec(fuelFor(t), 2) : ''; }, n: 1 },
    { t: 'Trängselskatt', v: function (t) { return numOf(t.trangsel) ? dec(numOf(t.trangsel), 2) : ''; }, n: 1 },
    { t: 'Status', v: function (t) { return isOpen(t) ? 'Påbörjad' : t.sentAt ? 'Inskickad ' + t.sentAt : 'Ej inskickad'; } }
  ];

  function renderAdmin() {
    var rows = adminRows();
    var km = 0, ers = 0, bransle = 0, tr = 0, liter = 0, oppna = 0;
    rows.forEach(function (t) {
      km += numOf(t.km); ers += ersFor(t); bransle += fuelFor(t);
      tr += numOf(t.trangsel); liter += literFor(t); if (isOpen(t)) oppna++;
    });
    $('adminSum').innerHTML =
      '<div class="row"><span>Resor</span><b>' + rows.length + (oppna ? ' (' + oppna + ' påbörjade)' : '') + '</b></div>' +
      '<div class="row"><span>Körsträcka</span><b>' + km + ' km</b></div>' +
      '<div class="row"><span>Milersättning</span><b>' + kr(ers) + '</b></div>' +
      '<div class="row"><span>Trängselskatt</span><b>' + kr(tr) + '</b></div>' +
      '<div class="row total"><span>Bränsle ca ' + dec(liter, 1) + ' l</span><b>' + kr(bransle) + '</b></div>';

    var html = '<thead><tr>' + ADMIN_COLS.map(function (c) {
      return '<th' + (c.n ? ' class="n"' : '') + '>' + c.t + '</th>';
    }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (t) {
      html += '<tr data-id="' + t.id + '">' + ADMIN_COLS.map(function (c) {
        return '<td' + (c.n ? ' class="n"' : '') + '>' + esc(c.v(t)) + '</td>';
      }).join('') + '</tr>';
    });
    $('adminTabell').innerHTML = html + '</tbody>';
    Array.prototype.forEach.call($('adminTabell').querySelectorAll('tr[data-id]'), function (tr2) {
      tr2.addEventListener('click', function () { openTrip(tr2.getAttribute('data-id')); });
    });
  }

  function adminTsv() {
    var lines = [ADMIN_COLS.map(function (c) { return c.t; }).join(TAB)];
    adminRows().forEach(function (t) {
      lines.push(ADMIN_COLS.map(function (c) { return c.v(t); }).join(TAB));
    });
    return lines.join(NL);
  }

  function openAdmin() {
    $('prisDatum').value = todayISO();
    $('prisVarde').value = '';
    renderBilar();
    renderPris();
    renderAdmin();
    renderBackupInfo();
    renderLockState();
    open($('sheetAdmin'));
  }

  /* ---------------- statistik ----------------
     Grupperar avslutade resor och visar km, bränsle och ersättning. */
  var STAT_KEYS = [
    { k: 'dag', t: 'Dag' }, { k: 'vecka', t: 'Vecka' }, { k: 'manad', t: 'Månad' },
    { k: 'kund', t: 'Kund' }, { k: 'ordernr', t: 'Ordernr' }, { k: 'resa', t: 'Rutt' }
  ];
  var statKey = 'manad', statCar = 'ALLA';

  function isoWeek(iso) {
    var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var dag = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dag);
    var start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var v = Math.ceil(((d - start) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + ' v' + pad(v);
  }
  function statLabel(t) {
    if (statKey === 'dag') return t.datum;
    if (statKey === 'vecka') return isoWeek(t.datum);
    if (statKey === 'manad') return monthLabel(monthKey(t.datum));
    if (statKey === 'kund') return t.kund || '(ingen kund)';
    if (statKey === 'ordernr') return t.ordernr || '(inget ordernr)';
    return (t.adressStart || '?') + ' → ' + (t.adressStopp || '?');
  }

  function statRows() {
    var g = {}, order = [];
    trips.forEach(function (t) {
      if (isOpen(t)) return;
      if (statCar !== 'ALLA' && t.bil !== statCar) return;
      var k = statLabel(t);
      if (!g[k]) { g[k] = { namn: k, antal: 0, km: 0, liter: 0, bransle: 0, ers: 0, trangsel: 0 }; order.push(k); }
      var r = g[k];
      r.antal++; r.km += numOf(t.km); r.liter += literFor(t);
      r.bransle += fuelFor(t); r.ers += ersFor(t); r.trangsel += numOf(t.trangsel);
    });
    var rows = order.map(function (k) { return g[k]; });
    /* tid faller i datumordning, övrigt sorteras på störst kostnad */
    if (statKey === 'dag' || statKey === 'vecka' || statKey === 'manad') rows.reverse();
    else rows.sort(function (a, b) { return b.km - a.km; });
    return rows;
  }

  function renderStats() {
    var rows = statRows(), out = $('statOut');
    if (!rows.length) { out.innerHTML = '<div class="empty">Inga avslutade resor att visa.</div>'; return; }
    var tot = { antal: 0, km: 0, liter: 0, bransle: 0, ers: 0 };
    rows.forEach(function (r) {
      tot.antal += r.antal; tot.km += r.km; tot.liter += r.liter;
      tot.bransle += r.bransle; tot.ers += r.ers;
    });
    var html = '<div class="stat-tot"><b>' + tot.km + ' km</b><span>' + tot.antal + ' resor</span>' +
      (tot.bransle ? '<b>' + kr(tot.bransle) + '</b><span>bränsle ca ' + dec(tot.liter, 1) + ' l</span>' : '') +
      (tot.ers ? '<b>' + kr(tot.ers) + '</b><span>milersättning</span>' : '') + '</div>';
    html += '<div class="stat-list">';
    rows.forEach(function (r) {
      html += '<div class="stat-row"><div class="stat-n"><b>' + esc(r.namn) + '</b>' +
        '<span>' + r.antal + (r.antal === 1 ? ' resa · ' : ' resor · ') + r.km + ' km</span></div>' +
        '<div class="stat-v">' + (r.bransle ? '<b>' + kr(r.bransle) + '</b><span>' + dec(r.liter, 1) + ' l</span>' : '<span>—</span>') +
        '</div></div>';
    });
    out.innerHTML = html + '</div>';
  }

  function statsTsv() {
    var head = [STAT_KEYS.filter(function (k) { return k.k === statKey; })[0].t,
                'ANTAL RESOR', 'KM', 'LITER', 'BRÄNSLE KR', 'TRÄNGSELSKATT', 'MILERSÄTTNING'];
    var lines = [head.join('\t')];
    statRows().forEach(function (r) {
      lines.push([r.namn, r.antal, r.km, dec(r.liter, 1),
                  dec(r.bransle, 2), dec(r.trangsel, 2), dec(r.ers, 2)].join('\t'));
    });
    return lines.join('\n');
  }

  function openStats() {
    segment($('statSeg'), STAT_KEYS.map(function (k) { return k.t; }),
      STAT_KEYS.filter(function (k) { return k.k === statKey; })[0].t,
      function (v) {
        statKey = STAT_KEYS.filter(function (k) { return k.t === v; })[0].k;
        renderStats();
      });
    $('statCar').innerHTML = '<option value="ALLA">Alla bilar</option>' +
      cars().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
    $('statCar').value = statCar;
    renderStats();
    open($('sheetStats'));
  }

  /* ---------------- start ---------------- */
  function init() {
    load(); render();
    if (lockOn()) showLock();

    $('btnNew').addEventListener('click', function () {
      openTrip(null);
    });
    $('btnSend').addEventListener('click', openSend);
    $('btnStats').addEventListener('click', openStats);
    $('btnAdmin').addEventListener('click', openAdmin);
    $('btnLockOn').addEventListener('click', enableLock);
    $('btnLockOff').addEventListener('click', disableLock);
    $('lockBio').addEventListener('click', tryBio);
    $('lockUseCode').addEventListener('click', function () {
      $('lockCodeBox').hidden = false;
      $('lockCode').focus();
    });
    $('lockCodeOk').addEventListener('click', function () {
      if (up($('lockCode').value) === LOCK_CODE) { $('lockCode').value = ''; hideLock(); }
      else { $('lockMsg').textContent = 'Fel kod.'; $('lockCode').value = ''; }
    });
    $('lockCode').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') $('lockCodeOk').click();
    });
    $('adminSok').addEventListener('input', renderAdmin);
    $('btnAdminTsv').addEventListener('click', function () { copyText(adminTsv(), 'Loggen kopierad'); });
    $('btnAddPris').addEventListener('click', function () {
      var d = $('prisDatum').value, p = numOf($('prisVarde').value);
      if (!d || !p) { toast('Fyll i datum och pris'); return; }
      addPris(d, p);
      $('prisVarde').value = '';
      renderPris(); renderAdmin(); render();
      toast('Dieselpris ' + kr(p) + '/l från ' + d);
    });
    $('statCar').addEventListener('change', function () { statCar = this.value; renderStats(); });
    $('btnCopyStats').addEventListener('click', function () { copyText(statsTsv(), 'Tabellen kopierad'); });

    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
      b.addEventListener('click', function () { close(b.closest('.sheet')); });
    });

    $('btnSave').addEventListener('click', function () { saveTrip(false); });
    $('btnSaveTop').addEventListener('click', function () { saveTrip(false); });
    $('btnSaveReturn').addEventListener('click', function () { saveTrip(true); });
    $('btnDelete').addEventListener('click', function () {
      if (!editId) return;
      if (!confirm('Ta bort resan?')) return;
      trips = trips.filter(function (t) { return t.id !== editId; });
      saveTrips(); render(); close($('sheetTrip')); toast('Resa borttagen');
    });

    geoSuggest($('fAdrStart'), $('dlAdrStart'), addressList);
    geoSuggest($('fAdrStopp'), $('dlAdrStopp'), addressList);
    $('gpsStart').addEventListener('click', function (e) { e.preventDefault(); useMyPosition(this, $('fAdrStart'), 'start'); });
    $('gpsStopp').addEventListener('click', function (e) { e.preventDefault(); useMyPosition(this, $('fAdrStopp'), 'stop'); });
    $('btnCalcKm').addEventListener('click', function (e) { e.preventDefault(); suggestFromMap(); });
    /* skriver man om adressen gäller inte den sparade GPS-punkten längre */
    $('fAdrStart').addEventListener('input', function () { delete $('sheetTrip').dataset.startLat; });
    $('fAdrStopp').addEventListener('input', function () { delete $('sheetTrip').dataset.stopLat; });

    $('btnAddTrangsel').addEventListener('click', function (e) { e.preventDefault(); addPassage(); });
    $('fTrangselBelopp').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); addPassage(); }
    });
    $('nowStart').addEventListener('click', function (e) { e.preventDefault(); $('fTidStart').value = nowHM(); });
    $('nowStopp').addEventListener('click', function (e) { e.preventDefault(); $('fTidStopp').value = nowHM(); });
    $('fMatStart').addEventListener('input', calcKm);
    $('fMatStopp').addEventListener('input', calcKm);
    $('dayPrev').addEventListener('click', function (e) { e.preventDefault(); $('fDatum').value = shiftISO($('fDatum').value || todayISO(), -1); });
    $('dayNext').addEventListener('click', function (e) { e.preventDefault(); $('fDatum').value = shiftISO($('fDatum').value || todayISO(), 1); });
    Array.prototype.forEach.call($('dateChips').querySelectorAll('.chip'), function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        $('fDatum').value = shiftISO(todayISO(), parseInt(b.getAttribute('data-day'), 10));
      });
    });

    $('adminMail').addEventListener('change', function () {
      settings.mail = up(this.value) || DEFAULT_MAIL;
      saveSettings(); toast('Mottagare sparad');
    });
    $('sendPeriod').addEventListener('change', updateRecap);
    $('sendPerson').addEventListener('change', updateRecap);
    $('btnMakePdf').addEventListener('click', sendPdf);
    $('btnOpenMail').addEventListener('click', function () {
      var sel = selection();
      if (!sel.length) return;
      openMail(mailBody({ sel: sel, pers: $('sendPerson').value === 'ALLA' ? 'Alla förare' : $('sendPerson').value }));
    });
    $('btnCopyTsv').addEventListener('click', function () { copyText(tsv(), 'Rader kopierade – klistra in i Excel'); });
    $('btnPreviewPdf').addEventListener('click', function () {
      var r = buildPdfBlob(); if (!r) return;
      var url = URL.createObjectURL(r.blob);
      window.open(url, '_blank');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    });

    $('btnExport').addEventListener('click', function () {
      var data = JSON.stringify({ v: 1, exported: new Date().toISOString(), settings: settings, trips: trips }, null, 2);
      downloadBlob(new Blob([data], { type: 'application/json' }), 'korjournal-backup-' + todayISO() + '.json');
      settings.backupAt = todayISO(); saveSettings(); renderBackupInfo();
      toast('Säkerhetskopia sparad');
    });
    $('btnImport').addEventListener('click', function () { $('fileImport').click(); });
    $('fileImport').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var d = JSON.parse(fr.result);
          if (!d.trips) throw new Error('fel format');
          if (!confirm('Ersätt ' + trips.length + ' resor med ' + d.trips.length + ' från filen?')) return;
          trips = d.trips; if (d.settings) settings = d.settings;
          saveTrips(); saveSettings(); render(); renderAdmin(); renderBilar();
          toast('Importerat: ' + trips.length + ' resor');
        } catch (e) { toast('Kunde inte läsa filen'); }
      };
      fr.readAsText(f);
      this.value = '';
    });

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    /* utan detta får webbläsaren slänga lagringen när utrymmet tryter */
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

    if (trips.length >= 10 && !settings.backupAt) {
      setTimeout(function () { toast('Ta en säkerhetskopia i inställningarna – datan finns bara här', 5000); }, 1200);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

