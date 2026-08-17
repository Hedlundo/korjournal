/* Körjournal – all data ligger lokalt i telefonen (localStorage). */
(function () {
  'use strict';

  var VER = '1.6.0';
  var K_TRIPS = 'kj.trips.v1', K_SET = 'kj.settings.v1';
  var MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
                'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  var DAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];

  var $ = function (id) { return document.getElementById(id); };
  var trips = [], settings = {};
  var editId = null;

  /* ---------------- lagring ---------------- */
  function load() {
    try { trips = JSON.parse(localStorage.getItem(K_TRIPS)) || []; } catch (e) { trips = []; }
    try { settings = JSON.parse(localStorage.getItem(K_SET)) || {}; } catch (e) { settings = {}; }
    if (!settings.verk) settings.verk = 'FILTER';
    if (!settings.drivers || !settings.drivers.length) settings.drivers = ['EBBA', 'GEORGE'];
    if (!settings.person) settings.person = settings.drivers[0];
    if (!settings.cars || !settings.cars.length) {
      // migrera från tidigare version som bara hade ett regnr
      settings.cars = (settings.regs && settings.regs.length) ? settings.regs.slice(0, 2)
                    : (settings.regnr ? [settings.regnr] : ['WXE84R']);
    }
    // bilarna är {nr, mil} sedan v1.3 – äldre versioner sparade bara regnumret
    settings.cars = settings.cars.map(function (c, i) {
      if (typeof c === 'string') return { nr: c, mil: i === 0 ? 25 : 0, forb: '' };
      return { nr: c.nr || '', mil: numOf(c.mil), forb: numOf(c.forb) || '' };
    }).filter(function (c) { return !!c.nr; });
    if (!settings.cars.length) settings.cars = [{ nr: 'WXE84R', mil: 25, forb: '' }];
    delete settings.regs;
    if (!settings.regnr || carNames().indexOf(settings.regnr) === -1) settings.regnr = settings.cars[0].nr;
    if (settings.tull == null) settings.tull = '';
    if (!settings.foretag) settings.foretag = 'AIRFILTER GROUP';
  }
  function carNames() {
    return (settings.cars || []).map(function (c) { return c.nr; }).filter(Boolean);
  }
  /* kr per mil för ett regnr – 0 om bilen inte ger milersättning */
  function rateFor(nr) {
    var c = carFor(nr);
    return c ? numOf(c.mil) : 0;
  }
  function carFor(nr) {
    return (settings.cars || []).filter(function (x) { return x.nr === nr; })[0] || null;
  }
  /* liter per mil – tom om förbrukningen inte är ifylld */
  function forbFor(nr) {
    var c = carFor(nr);
    return c ? numOf(c.forb) : 0;
  }
  function drivers() {
    return (settings.drivers || []).filter(function (d) { return !!d; });
  }
  function cars() {
    var c = carNames();
    return c.length ? c : ['WXE84R'];
  }
  /* belopp: 4057.5 → "4 057,50 kr" */
  function kr(v) {
    var p = (Math.round(numOf(v) * 100) / 100).toFixed(2).split('.');
    return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + p[1] + ' kr';
  }
  function mil(km) { return (Math.round(km * 10) / 100).toString().replace('.', ','); }
  /* milersättning för en resa */
  function ersFor(t) {
    var r = rateFor(t.regnr);
    return r ? Math.round(numOf(t.km) / 10 * r * 100) / 100 : 0;
  }
  /* uppskattad dieselåtgång och kostnad för en resa */
  function literFor(t) {
    var f = forbFor(t.regnr);
    return f ? Math.round(numOf(t.km) / 10 * f * 10) / 10 : 0;
  }
  function fuelFor(t) {
    var l = literFor(t), p = numOf(settings.diesel);
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

  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, ms || 2200);
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
    el.innerHTML = '';
    arr.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = v;
      b.addEventListener('click', function (e) { e.preventDefault(); onPick(v); });
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
      utlagg += numOf(t.trangsel) + numOf(t.tull);
    });
    $('summary').innerHTML =
      '<div class="big">' + km + '<span>km</span></div>' +
      '<div class="meta">' + MONTHS[+thisMonth.slice(5, 7) - 1] + ' · ' + cnt + ' resor</div>' +
      (ers || utlagg ? '<div class="pay">' + kr(ers + utlagg) + '<span>att ersätta</span></div>' : '');

    var html = '', curM = null;
    s.forEach(function (t) {
      var mk = monthKey(t.datum);
      if (mk !== curM) {
        curM = mk;
        var mkm = 0, mc = 0;
        trips.forEach(function (x) { if (monthKey(x.datum) === mk) { mkm += numOf(x.km); mc++; } });
        html += '<div class="month-head"><span>' + monthLabel(mk) + '</span>' +
                '<span class="tot">' + mc + ' resor · ' + mkm + ' km</span></div>';
      }
      var d = t.datum.split('-');
      html += '<button class="trip" data-id="' + t.id + '">' +
        '<span class="d"><b>' + d[2] + '</b><i>' + weekday(t.datum) + '</i></span>' +
        '<span class="mid"><b>' + esc(t.kund || '—') + '</b>' +
        '<span>' + esc(t.adressStart || '') + ' → ' + esc(t.adressStopp || '') + '</span></span>' +
        '<span class="km">' + numOf(t.km) + ' <i>km</i></span></button>';
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
      if (t.adressStart == null) t.adressStart = prev ? prev.adressStopp : (settings.home || '');
      if (!t.verksamhet) t.verksamhet = settings.verk || '';
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
    $('startHint').textContent = (!id && prev && t.matStart && t.matStart === prev.matStopp)
      ? 'Ifylld från förra resan, som slutade på ' + prev.matStopp + '.'
      : 'Läs av mätaren innan du kör.';
    $('fTull').value = t.tull || '';
    $('sheetTrip').dataset.tullAntal = t.tullAntal || 0;
    renderTull();
    $('fTrangsel').value = t.trangsel || '';
    $('fVerksamhet').value = t.verksamhet || settings.verk || '';

    var list = drivers();
    var person = t.person || settings.person || list[0] || '';
    if (list.indexOf(person) === -1 && person) list = list.concat([person]);
    var carList = cars();
    var regnr = t.regnr || settings.regnr || carList[0];
    if (carList.indexOf(regnr) === -1 && regnr) carList = carList.concat([regnr]);
    $('sheetTrip').dataset.person = person;
    $('sheetTrip').dataset.regnr = regnr;

    segment($('whoSeg'), list, person, function (v) { $('sheetTrip').dataset.person = v; });
    segment($('carSeg'), carList, regnr, function (v) { $('sheetTrip').dataset.regnr = v; calcKm(); });
    if (carList.length < 2) addCarButton();

    fillDatalist($('dlKund'), freqList('kund'));
    fillDatalist($('dlSyfte'), freqList('syfte'));
    fillDatalist($('dlAdrStart'), addressList());
    fillDatalist($('dlAdrStopp'), addressList());
    fillDatalist($('dlVerk'), freqList('verksamhet').concat(settings.verk ? [settings.verk] : []));

    chipRow($('kundChips'), freqList('kund', 4), function (v) { $('fKund').value = v; });
    chipRow($('syfteChips'), freqList('syfte', 4), function (v) { $('fSyfte').value = v; });
    var adr = addressList(4);
    chipRow($('fromChips'), adr, function (v) { $('fAdrStart').value = v; });
    chipRow($('toChips'), adr, function (v) { $('fAdrStopp').value = v; calcKm(); });

    calcKm();
    open($('sheetTrip'));
    $('sheetTrip').querySelector('.sheet-body').scrollTop = 0;
  }

  /* plats för bil nr 2 tills regnumret är känt */
  function addCarButton() {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ghost-seg';
    b.textContent = '+ Lägg till bil';
    b.addEventListener('click', function (e) { e.preventDefault(); openSettings(); });
    $('carSeg').appendChild(b);
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
  function useMyPosition(btn, input) {
    if (!navigator.geolocation) { toast('Telefonen delar inte plats'); return; }
    btn.classList.add('busy');
    var done = function (msg) { btn.classList.remove('busy'); if (msg) toast(msg, 3000); };
    navigator.geolocation.getCurrentPosition(function (pos) {
      var c = pos.coords;
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

  /* tull: varje tryck är en passage, beloppet räknas upp med standardavgiften */
  function renderTull() {
    var n = parseInt($('sheetTrip').dataset.tullAntal, 10) || 0;
    $('tullInfo').textContent = n ? (n + (n === 1 ? ' passage' : ' passager')) : 'Inga passager';
    $('tullReset').hidden = !n;
  }
  function addTull(step) {
    var el = $('sheetTrip');
    var n = Math.max(0, (parseInt(el.dataset.tullAntal, 10) || 0) + step);
    el.dataset.tullAntal = n;
    var avg = numOf(settings.tull);
    if (avg) $('fTull').value = n ? Math.round(n * avg * 100) / 100 : '';
    renderTull();
    if (step > 0) toast(avg ? 'Tull tillagd · ' + kr(numOf($('fTull').value)) : 'Passage registrerad – fyll i beloppet');
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
    var nr = $('sheetTrip').dataset.regnr, f = forbFor(nr), p = numOf(settings.diesel);
    if (!km || !f || !p) { $('fuelOut').textContent = ''; return; }
    var liter = Math.round(km / 10 * f * 10) / 10;
    $('fuelOut').textContent = 'Bränsle ca ' + dec(liter, 1) + ' l · ' + kr(liter * p) + ' (' + nr + ')';
  }

  function readForm() {
    return {
      datum: $('fDatum').value || todayISO(),
      kund: up($('fKund').value),
      syfte: up($('fSyfte').value),
      verksamhet: up($('fVerksamhet').value),
      adressStart: up($('fAdrStart').value),
      adressStopp: up($('fAdrStopp').value),
      matStart: intOf($('fMatStart').value),
      matStopp: intOf($('fMatStopp').value),
      trangsel: numOf($('fTrangsel').value) || '',
      tull: numOf($('fTull').value) || '',
      tullAntal: parseInt($('sheetTrip').dataset.tullAntal, 10) || 0,
      person: $('sheetTrip').dataset.person || '',
      regnr: $('sheetTrip').dataset.regnr || ''
    };
  }

  function saveTrip(thenReturn) {
    var f = readForm();
    if (!f.kund) { toast('Fyll i kund'); $('fKund').focus(); return; }
    if (!f.matStart || !f.matStopp) { toast('Fyll i mätarställning'); $('fMatStopp').focus(); return; }
    if (f.matStopp < f.matStart) { toast('Stopp måste vara högre än start'); $('fMatStopp').focus(); return; }
    if (!f.adressStopp) { toast('Fyll i adress stopp'); $('fAdrStopp').focus(); return; }
    f.km = f.matStopp - f.matStart;

    if (editId) {
      for (var i = 0; i < trips.length; i++) if (trips[i].id === editId) {
        f.id = editId; f.createdAt = trips[i].createdAt; trips[i] = f;
      }
    } else {
      f.id = uid(); f.createdAt = new Date().toISOString();
      trips.push(f);
    }
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
      toast('Resa sparad · ' + f.km + ' km');
    }
  }

  /* ---------------- inställningar ---------------- */
  function openSettings() {
    $('sDriver1').value = (settings.drivers || [])[0] || '';
    $('sDriver2').value = (settings.drivers || [])[1] || '';
    renderDefaultDriver(settings.person);
    var c = settings.cars || [];
    $('sCar1').value = (c[0] && c[0].nr) || '';
    $('sMil1').value = (c[0] && c[0].mil) || '';
    $('sForb1').value = (c[0] && c[0].forb) || '';
    $('sCar2').value = (c[1] && c[1].nr) || '';
    $('sMil2').value = (c[1] && c[1].mil) || '';
    $('sForb2').value = (c[1] && c[1].forb) || '';
    $('sDiesel').value = settings.diesel || '';
    renderDefaultCar(settings.regnr);
    $('sHome').value = settings.home || '';
    $('sVerk').value = settings.verk || '';
    $('sTull').value = settings.tull || '';
    $('sMail').value = settings.mail || '';
    $('verInfo').textContent = 'Körjournal ' + VER + ' · ' + trips.length + ' resor sparade i den här telefonen';
    open($('sheetSettings'));
  }
  function renderDefaultDriver(active) {
    var d1 = up($('sDriver1').value).toUpperCase(), d2 = up($('sDriver2').value).toUpperCase();
    var list = [d1, d2].filter(Boolean);
    if (!list.length) list = ['EBBA', 'GEORGE'];
    if (list.indexOf(active) === -1) active = list[0];
    $('sDefaultDriver').dataset.value = active;
    segment($('sDefaultDriver'), list, active, function (v) { $('sDefaultDriver').dataset.value = v; });
  }
  function renderDefaultCar(active) {
    var c1 = up($('sCar1').value).toUpperCase(), c2 = up($('sCar2').value).toUpperCase();
    var list = [c1, c2].filter(Boolean);
    if (!list.length) list = ['WXE84R'];
    if (list.indexOf(active) === -1) active = list[0];
    $('sDefaultCar').dataset.value = active;
    segment($('sDefaultCar'), list, active, function (v) { $('sDefaultCar').dataset.value = v; });
  }

  function storeSettings() {
    var first = !settings.setup;
    var d1 = up($('sDriver1').value).toUpperCase(), d2 = up($('sDriver2').value).toUpperCase();
    settings.drivers = [d1 || 'EBBA', d2 || 'GEORGE'].filter(Boolean);
    var def = $('sDefaultDriver').dataset.value || '';
    settings.person = settings.drivers.indexOf(def) >= 0 ? def : settings.drivers[0];

    var c1 = up($('sCar1').value).toUpperCase(), c2 = up($('sCar2').value).toUpperCase();
    settings.cars = [
      { nr: c1, mil: numOf($('sMil1').value), forb: numOf($('sForb1').value) || '' },
      { nr: c2, mil: numOf($('sMil2').value), forb: numOf($('sForb2').value) || '' }
    ].filter(function (c) { return !!c.nr; });
    if (!settings.cars.length) settings.cars = [{ nr: 'WXE84R', mil: 25, forb: '' }];
    settings.diesel = numOf($('sDiesel').value) || '';
    var dc = $('sDefaultCar').dataset.value || '';
    settings.regnr = carNames().indexOf(dc) >= 0 ? dc : settings.cars[0].nr;
    settings.home = up($('sHome').value);
    settings.verk = up($('sVerk').value);
    settings.tull = numOf($('sTull').value) || '';
    settings.mail = up($('sMail').value);
    settings.setup = true;
    saveSettings();
    close($('sheetSettings'));
    if (first && !trips.length) {
      // första gången: gå direkt vidare till resan istället för en tom lista
      toast('Klart – fyll i din första resa', 3000);
      setTimeout(function () { openTrip(null); }, 350);
    } else toast('Inställningar sparade');
  }

  /* ---------------- skicka in ---------------- */
  function openSend() {
    var keys = {}, i;
    for (i = 0; i < trips.length; i++) keys[monthKey(trips[i].datum)] = 1;
    var months = Object.keys(keys).sort().reverse();
    if (!months.length) { toast('Inga resor att skicka in'); return; }

    $('sendPeriod').innerHTML = months.map(function (m) {
      return '<option value="' + m + '">' + monthLabel(m) + '</option>';
    }).join('') + '<option value="ALLA">Alla resor</option>';
    var cur = monthKey(todayISO());
    $('sendPeriod').value = months.indexOf(cur) >= 0 ? cur : months[0];

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
      if (per !== 'ALLA' && monthKey(t.datum) !== per) return false;
      if (pers !== 'ALLA' && t.person !== pers) return false;
      return true;
    }).sort(function (a, b) {
      if (a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
      return (a.matStart || 0) - (b.matStart || 0);
    });
  }

  /* sammanställning i tre delar: milersättning, utlägg och bränsle för bokföringen */
  function summaryLines(sel) {
    var byCar = {}, order = [], tr = 0, tull = 0, tullN = 0, i;
    for (i = 0; i < sel.length; i++) {
      var t = sel[i], nr = t.regnr || '—';
      if (byCar[nr] == null) { byCar[nr] = 0; order.push(nr); }
      byCar[nr] += numOf(t.km);
      tr += numOf(t.trangsel);
      tull += numOf(t.tull);
      tullN += parseInt(t.tullAntal, 10) || 0;
    }

    var lines = [], totErs = 0, utlagg = tr + tull;

    /* milersättning – bara bilar med kr/mil */
    var medErs = order.filter(function (nr) { return rateFor(nr) > 0; });
    if (medErs.length) {
      lines.push({ head: 'Milersättning' });
      medErs.forEach(function (nr) {
        var km = byCar[nr], rate = rateFor(nr), belopp = Math.round(km / 10 * rate * 100) / 100;
        totErs += belopp;
        lines.push({ label: nr + ' - ' + km + ' km (' + mil(km) + ' mil x ' + rate + ' kr/mil)', value: kr(belopp) });
      });
    }
    var utanErs = order.filter(function (nr) { return !rateFor(nr); });
    utanErs.forEach(function (nr) {
      lines.push({ note: nr + ' - ' + byCar[nr] + ' km, företagsbil utan milersättning' });
    });

    /* utlägg – redovisas var för sig men ingår i summan */
    if (utlagg) {
      lines.push({ head: 'Utlägg' });
      if (tr) lines.push({ label: 'Trängselskatt', value: kr(tr) });
      if (tull) lines.push({ label: 'Tull' + (tullN ? ' (' + tullN + (tullN === 1 ? ' passage)' : ' passager)') : ''), value: kr(tull) });
      if (tr && tull) lines.push({ label: 'Summa utlägg', value: kr(utlagg), sub: true });
    }

    lines.push({ rule: true });
    lines.push({ label: 'Att ersätta', value: kr(totErs + utlagg), bold: true });

    /* bränsle – bokföring, ingen ersättning */
    var pris = numOf(settings.diesel), fuelCars = order.filter(function (nr) { return forbFor(nr) > 0; });
    if (pris && fuelCars.length) {
      lines.push({ head: 'Beräknad bränslekostnad (bokföring)' });
      var totL = 0, totKost = 0;
      fuelCars.forEach(function (nr) {
        var km = byCar[nr], f = forbFor(nr);
        var liter = Math.round(km / 10 * f * 10) / 10, kost = Math.round(liter * pris * 100) / 100;
        totL += liter; totKost += kost;
        lines.push({ label: nr + ' - ' + dec(liter, 1) + ' l (' + dec(f, 2) + ' l/mil)', value: kr(kost) });
      });
      if (fuelCars.length > 1) {
        lines.push({ label: 'Summa bränsle ' + dec(totL, 1) + ' l', value: kr(totKost), sub: true });
      }
      lines.push({ note: 'Uppskattning på ' + kr(pris) + '/liter diesel. Ingår inte i ersättningen.' });
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
    return p === 'ALLA' ? 'Alla resor' : monthLabel(p);
  }

  function pdfRows(sel) {
    return sel.map(function (t) {
      return {
        kund: t.kund, syfte: t.syfte, verksamhet: t.verksamhet,
        datum: yymmdd(t.datum),
        matStart: String(t.matStart || ''), matStopp: String(t.matStopp || ''),
        km: String(numOf(t.km)),
        adressStart: t.adressStart, adressStopp: t.adressStopp,
        trangsel: t.trangsel ? KJPdf.fmtKr(numOf(t.trangsel)) : '',
        tull: t.tull ? KJPdf.fmtKr(numOf(t.tull)) : '',
        bransle: fuelFor(t) ? KJPdf.fmtKr(Math.round(fuelFor(t))) : '',
        person: t.person, regnr: t.regnr,
        _km: numOf(t.km), _trangsel: numOf(t.trangsel), _tull: numOf(t.tull), _bransle: fuelFor(t)
      };
    });
  }

  function buildPdfBlob() {
    var sel = selection();
    if (!sel.length) return null;
    var pers = $('sendPerson').value === 'ALLA' ? 'Alla förare' : $('sendPerson').value;
    var regs = {}; sel.forEach(function (t) { if (t.regnr) regs[t.regnr] = 1; });
    var fname = 'Korjournal_' +
      ($('sendPeriod').value === 'ALLA' ? 'alla' : $('sendPeriod').value) + '_' +
      (pers.replace(/[^A-Za-z0-9ÅÄÖåäö]+/g, '-') || 'forare') + '.pdf';
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
    return 'Hej,\n\nHär kommer körjournal för ' + periodLabel().toLowerCase() + '.\n' +
           'Förare: ' + r.pers + '\n' +
           'Antal resor: ' + r.sel.length + '\n' +
           'Körsträcka: ' + km + ' km\n\n' +
           sum + '\n' +
           'Körjournalen är bifogad som PDF.\n';
  }

  function sendPdf() {
    var r = buildPdfBlob();
    if (!r) return;
    var subject = 'Körjournal ' + periodLabel() + ' – ' + r.pers;
    var body = mailBody(r);

    var file = null;
    try { file = new File([r.blob], r.name, { type: 'application/pdf' }); } catch (e) { file = null; }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: subject, text: body })
        .then(function () { toast('Körjournalen är skickad till mejlappen'); })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          fallback(r, subject, body);
        });
    } else {
      fallback(r, subject, body);
    }
  }

  function fallback(r, subject, body) {
    downloadBlob(r.blob, r.name);
    toast('PDF sparad – bifoga den i mejlet', 4000);
    setTimeout(function () {
      window.location.href = 'mailto:' + encodeURIComponent(settings.mail || '') +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body + '\n(Bifoga filen ' + r.name + ' från Nedladdningar.)');
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
    var head = ['KUND', 'SYFTE', 'VERKSAMHET', 'DATUM', 'MÄTARSTÄLLNING START', 'MÄTARSTÄLLNING STOPP',
                'KM', 'ADRESS START', 'ADRESS STOPP', 'TRÄNGSELSKATT', 'TULL', 'BRÄNSLE CA', 'PERSON', 'REGNR'];
    var lines = [head.join('\t')];
    pdfRows(selection()).forEach(function (r) {
      lines.push([r.kund, r.syfte, r.verksamhet, r.datum, r.matStart, r.matStopp, r.km,
                  r.adressStart, r.adressStopp, r.trangsel, r.tull, r.bransle, r.person, r.regnr].join('\t'));
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

  /* ---------------- start ---------------- */
  function init() {
    load(); render();

    $('btnNew').addEventListener('click', function () {
      if (!settings.setup) { toast('Kontrollera inställningarna först'); openSettings(); return; }
      openTrip(null);
    });
    $('btnSend').addEventListener('click', openSend);
    $('btnSettings').addEventListener('click', openSettings);

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
    $('gpsStart').addEventListener('click', function (e) { e.preventDefault(); useMyPosition(this, $('fAdrStart')); });
    $('gpsStopp').addEventListener('click', function (e) { e.preventDefault(); useMyPosition(this, $('fAdrStopp')); });

    $('btnTull').addEventListener('click', function (e) { e.preventDefault(); addTull(1); });
    $('tullReset').addEventListener('click', function (e) {
      e.preventDefault();
      $('sheetTrip').dataset.tullAntal = 0;
      if (numOf(settings.tull)) $('fTull').value = '';
      renderTull();
    });
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

    $('btnSaveSettings').addEventListener('click', storeSettings);
    $('sDriver1').addEventListener('input', function () { renderDefaultDriver($('sDefaultDriver').dataset.value); });
    $('sDriver2').addEventListener('input', function () { renderDefaultDriver($('sDefaultDriver').dataset.value); });
    $('sCar1').addEventListener('input', function () { renderDefaultCar($('sDefaultCar').dataset.value); });
    $('sCar2').addEventListener('input', function () { renderDefaultCar($('sDefaultCar').dataset.value); });
    $('sendPeriod').addEventListener('change', updateRecap);
    $('sendPerson').addEventListener('change', updateRecap);
    $('btnMakePdf').addEventListener('click', sendPdf);
    $('btnCopyMail').addEventListener('click', function () { copyText(settings.mail || '', 'Adress kopierad'); });
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
          saveTrips(); saveSettings(); render(); close($('sheetSettings'));
          toast('Importerat: ' + trips.length + ' resor');
        } catch (e) { toast('Kunde inte läsa filen'); }
      };
      fr.readAsText(f);
      this.value = '';
    });

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    if (!settings.setup) setTimeout(openSettings, 400);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

