/* Körjournal – all data ligger lokalt i telefonen (localStorage). */
(function () {
  'use strict';

  var VER = '1.1.0';
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
    if (!settings.regs) settings.regs = [];
    if (!settings.drivers || !settings.drivers.length) settings.drivers = ['EBBA', 'GEORGE'];
    if (!settings.person) settings.person = settings.drivers[0];
  }
  function drivers() {
    return (settings.drivers || []).filter(function (d) { return !!d; });
  }
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
    var thisMonth = monthKey(todayISO()), km = 0, cnt = 0, tr = 0;
    trips.forEach(function (t) {
      if (monthKey(t.datum) === thisMonth) { km += numOf(t.km); cnt++; tr += numOf(t.trangsel); }
    });
    $('summary').innerHTML =
      '<div class="big">' + km + '<span>km</span></div>' +
      '<div class="meta">' + MONTHS[+thisMonth.slice(5, 7) - 1] + ' · ' + cnt + ' resor' +
      (tr ? ' · ' + KJPdf.fmtKr(tr) + ' kr trängselskatt' : '') + '</div>';

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
    $('fTrangsel').value = t.trangsel || '';
    $('fVerksamhet').value = t.verksamhet || settings.verk || '';

    var list = drivers();
    var person = t.person || settings.person || list[0] || '';
    if (list.indexOf(person) === -1 && person) list = list.concat([person]);
    var regnr = t.regnr || settings.regnr || '';
    $('sheetTrip').dataset.person = person;
    $('sheetTrip').dataset.regnr = regnr;

    segment($('whoSeg'), list, person, function (v) { $('sheetTrip').dataset.person = v; });
    $('whoReg').textContent = 'Bil: ' + (regnr || 'inget regnr valt');
    $('whoEdit').onclick = function (e) {
      e.preventDefault();
      var regs = settings.regs || [];
      if (regs.length > 1) {                       // fler bilar → växla direkt
        var i = regs.indexOf($('sheetTrip').dataset.regnr);
        var next = regs[(i + 1) % regs.length];
        $('sheetTrip').dataset.regnr = next;
        $('whoReg').textContent = 'Bil: ' + next;
      } else openSettings();
    };

    fillDatalist($('dlKund'), freqList('kund'));
    fillDatalist($('dlSyfte'), freqList('syfte'));
    fillDatalist($('dlAdr'), addressList());
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

  function calcKm() {
    var a = intOf($('fMatStart').value), b = intOf($('fMatStopp').value);
    var out = $('kmOut'), hint = $('kmHint');
    if (!a && !b) { out.className = 'km-out'; out.innerHTML = '<b>0</b> km'; hint.textContent = 'Fyll i mätarställning start och stopp.'; return; }
    if (b && a && b < a) { out.className = 'km-out bad'; out.innerHTML = '<b>' + (b - a) + '</b> km'; hint.textContent = 'Stoppvärdet är lägre än startvärdet.'; return; }
    var km = (a && b) ? b - a : 0;
    out.className = 'km-out'; out.innerHTML = '<b>' + km + '</b> km';
    hint.textContent = km ? '' : 'Fyll i mätarställning stopp.';
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
    $('sRegnr').value = settings.regnr || '';
    $('sHome').value = settings.home || '';
    $('sVerk').value = settings.verk || '';
    $('sMail').value = settings.mail || '';
    chipRow($('regChips'), (settings.regs || []).slice(0, 5), function (v) { $('sRegnr').value = v; });
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

  function storeSettings() {
    var d1 = up($('sDriver1').value).toUpperCase(), d2 = up($('sDriver2').value).toUpperCase();
    settings.drivers = [d1 || 'EBBA', d2 || 'GEORGE'].filter(Boolean);
    var def = $('sDefaultDriver').dataset.value || '';
    settings.person = settings.drivers.indexOf(def) >= 0 ? def : settings.drivers[0];
    settings.regnr = up($('sRegnr').value).toUpperCase();
    settings.home = up($('sHome').value);
    settings.verk = up($('sVerk').value);
    settings.mail = up($('sMail').value);
    if (settings.regnr && (settings.regs || []).indexOf(settings.regnr) === -1) {
      settings.regs = [settings.regnr].concat(settings.regs || []).slice(0, 5);
    }
    saveSettings();
    close($('sheetSettings'));
    toast('Inställningar sparade');
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

  function updateRecap() {
    var sel = selection(), km = 0, tr = 0;
    sel.forEach(function (t) { km += numOf(t.km); tr += numOf(t.trangsel); });
    $('sendRecap').innerHTML =
      '<div class="row"><span>Period</span><b>' + esc(periodLabel()) + '</b></div>' +
      '<div class="row"><span>Förare</span><b>' + esc($('sendPerson').value === 'ALLA' ? 'Alla' : $('sendPerson').value) + '</b></div>' +
      '<div class="row"><span>Antal resor</span><b>' + sel.length + '</b></div>' +
      (tr ? '<div class="row"><span>Trängselskatt</span><b>' + KJPdf.fmtKr(tr) + ' kr</b></div>' : '') +
      '<div class="row total"><span>Totalt</span><b>' + km + ' km</b></div>';
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
        person: t.person, regnr: t.regnr,
        _km: numOf(t.km), _trangsel: numOf(t.trangsel)
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
      footer: fname
    });
    return { blob: new Blob([bytes], { type: 'application/pdf' }), name: fname, sel: sel, pers: pers };
  }

  function mailBody(r) {
    var km = 0; r.sel.forEach(function (t) { km += numOf(t.km); });
    return 'Hej,\n\nHär kommer körjournal för ' + periodLabel().toLowerCase() + '.\n' +
           'Förare: ' + r.pers + '\n' +
           'Antal resor: ' + r.sel.length + '\n' +
           'Totalt: ' + km + ' km\n\n' +
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
                'KM', 'ADRESS START', 'ADRESS STOPP', 'TRÄNGSELSKATT', 'PERSON', 'REGNR'];
    var lines = [head.join('\t')];
    pdfRows(selection()).forEach(function (r) {
      lines.push([r.kund, r.syfte, r.verksamhet, r.datum, r.matStart, r.matStopp, r.km,
                  r.adressStart, r.adressStopp, r.trangsel, r.person, r.regnr].join('\t'));
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
      if (!settings.regnr) { toast('Fyll i regnr först'); openSettings(); return; }
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
    if (!settings.regnr) setTimeout(openSettings, 400);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

