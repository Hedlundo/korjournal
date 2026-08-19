/* Minimal PDF-generator för körjournal – inga externa beroenden.
   Genererar A4 liggande med tabell, sidbrytning, summarad och sidfot. */
(function (global) {
  'use strict';

  /* ---------- teckenbredder (Helvetica / Helvetica-Bold, per 1000 em) ---------- */
  var WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
            556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
            1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
            667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
            333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
            556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
            556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
            975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
            667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
            333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
            611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

  /* Latin-1-tecken → motsvarande grundbokstav (samma bredd i Helvetica) */
  var BASE = {};
  (function () {
    function set(from, to, ch) { for (var c = from; c <= to; c++) BASE[c] = ch.charCodeAt(0); }
    set(0xC0, 0xC5, 'A'); BASE[0xC7] = 67; set(0xC8, 0xCB, 'E'); set(0xCC, 0xCF, 'I');
    BASE[0xD0] = 68; BASE[0xD1] = 78; set(0xD2, 0xD6, 'O'); BASE[0xD8] = 79;
    set(0xD9, 0xDC, 'U'); BASE[0xDD] = 89; BASE[0xDF] = 98;
    set(0xE0, 0xE5, 'a'); BASE[0xE7] = 99; set(0xE8, 0xEB, 'e'); set(0xEC, 0xEF, 'i');
    BASE[0xF1] = 110; set(0xF2, 0xF6, 'o'); BASE[0xF8] = 111; set(0xF9, 0xFC, 'u');
    BASE[0xFD] = 121; BASE[0xFF] = 121;
  })();

  /* Unicode → WinAnsi för tecken utanför Latin-1 */
  var WIN = { 0x20AC: 0x80, 0x201A: 0x82, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92,
              0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97 };

  function toWin(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c <= 0xFF) out += String.fromCharCode(c);
      else if (WIN[c]) out += String.fromCharCode(WIN[c]);
      else out += '?';
    }
    return out;
  }

  function charW(code, bold) {
    var t = bold ? WB : WR;
    if (code >= 32 && code <= 126) return t[code - 32];
    if (BASE[code] != null) return t[BASE[code] - 32];
    return t[('n').charCodeAt(0) - 32];
  }

  function textW(s, size, bold) {
    var w = 0;
    for (var i = 0; i < s.length; i++) w += charW(s.charCodeAt(i), bold);
    return w * size / 1000;
  }

  function wrap(s, maxW, size, bold) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (!s) return [''];
    var words = s.split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var test = cur ? cur + ' ' + w : w;
      if (textW(test, size, bold) <= maxW) { cur = test; continue; }
      if (cur) { lines.push(cur); cur = ''; }
      while (textW(w, size, bold) > maxW && w.length > 1) {
        var n = 1;
        while (n < w.length && textW(w.slice(0, n + 1), size, bold) <= maxW) n++;
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      cur = w;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function esc(s) { return toWin(s).replace(/([\\()])/g, '\\$1'); }
  function n(v) { return (Math.round(v * 100) / 100).toString(); }

  /* ---------- sid-/ritmotor ---------- */
  function Page(w, h) { this.w = w; this.h = h; this.ops = []; }
  Page.prototype.rect = function (x, y, w, h, rgb) {
    this.ops.push(n(rgb[0]) + ' ' + n(rgb[1]) + ' ' + n(rgb[2]) + ' rg ' +
                  n(x) + ' ' + n(y) + ' ' + n(w) + ' ' + n(h) + ' re f');
  };
  Page.prototype.line = function (x1, y1, x2, y2, g, lw) {
    this.ops.push(n(g) + ' G ' + n(lw || 0.5) + ' w ' +
                  n(x1) + ' ' + n(y1) + ' m ' + n(x2) + ' ' + n(y2) + ' l S');
  };
  Page.prototype.text = function (s, x, y, size, bold, align, maxW, gray) {
    s = String(s == null ? '' : s);
    if (!s) return;
    var w = textW(s, size, bold);
    if (maxW && w > maxW) {           // sista utvägen: klipp
      while (s.length > 1 && textW(s + '…', size, bold) > maxW) s = s.slice(0, -1);
      s += '…'; w = textW(s, size, bold);
    }
    var tx = align === 'r' ? x - w : align === 'c' ? x - w / 2 : x;
    this.ops.push('BT ' + (gray != null ? n(gray) + ' g ' : '0 g ') +
                  '/' + (bold ? 'F2' : 'F1') + ' ' + n(size) + ' Tf ' +
                  '1 0 0 1 ' + n(tx) + ' ' + n(y) + ' Tm (' + esc(s) + ') Tj ET');
  };

  function assemble(pages) {
    var objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    var kids = [], id = 5;
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i], pid = id++, cid = id++;
      kids.push(pid + ' 0 R');
      objs[pid] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(p.w) + ' ' + n(p.h) + '] ' +
                  '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + cid + ' 0 R >>';
      var body = p.ops.join('\n');
      objs[cid] = '<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream';
    }
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages.length + ' >>';

    var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', offs = [];
    for (var k = 1; k < id; k++) {
      offs[k] = out.length;
      out += k + ' 0 obj\n' + objs[k] + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + id + '\n0000000000 65535 f \n';
    for (var j = 1; j < id; j++) {
      out += ('0000000000' + offs[j]).slice(-10) + ' 00000 n \n';
    }
    out += 'trailer\n<< /Size ' + id + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';

    var bytes = new Uint8Array(out.length);
    for (var b = 0; b < out.length; b++) bytes[b] = out.charCodeAt(b) & 0xFF;
    return bytes;
  }

  /* ---------- körjournal ---------- */
  var COLS = [
    { k: 'kund',        t: 'KUND',              w: 88 },
    { k: 'kontakt',     t: 'KONTAKT',           w: 62 },
    { k: 'syfte',       t: 'SYFTE',             w: 84 },
    { k: 'ordernr',     t: 'ORDERNR',           w: 48 },
    { k: 'verksamhet',  t: 'VERKSAMHET',        w: 62 },
    { k: 'datum',       t: 'DATUM',             w: 42, a: 'r' },
    { k: 'tid',         t: 'TID',               w: 48 },
    { k: 'matStart',    t: 'MÄTARE START',      w: 48, a: 'r' },
    { k: 'matStopp',    t: 'MÄTARE STOPP',      w: 48, a: 'r' },
    { k: 'km',          t: 'KM',                w: 32, a: 'r' },
    { k: 'adressStart', t: 'ADRESS START',      w: 92 },
    { k: 'adressStopp', t: 'ADRESS STOPP',      w: 92 },
    { k: 'trangsel',    t: 'TRÄNGSEL SKATT',    w: 52, a: 'r' },
    { k: 'bransle',     t: 'BRÄNSLE CA',        w: 48, a: 'r' },
    { k: 'person',      t: 'PERSON',            w: 68 },
    { k: 'regnr',       t: 'REGNR',             w: 40 }
  ];

  var PW = 842, PH = 595, M = 22, PAD = 3;
  var FS = 6.8, LH = 8.2, HFS = 6.2;
  var YELLOW = [1, 0.82, 0], GRAYF = [0.94, 0.94, 0.95], DARK = [0.07, 0.07, 0.08];

  function build(rows, meta) {
    meta = meta || {};
    var tableW = 0, i;
    for (i = 0; i < COLS.length; i++) tableW += COLS[i].w;
    var scale = (PW - 2 * M) / tableW;
    var w = [], x0 = M, xs = [];
    for (i = 0; i < COLS.length; i++) { w[i] = COLS[i].w * scale; xs[i] = x0; x0 += w[i]; }
    var right = M + (PW - 2 * M);
    function ci(key) { for (var q = 0; q < COLS.length; q++) if (COLS[q].k === key) return q; return 0; }
    function rx(key) { return xs[ci(key)] + w[ci(key)] - PAD; }

    var pages = [], page = null, y = 0, pageNo = 0;

    function header(withTable) {
      page = new Page(PW, PH); pages.push(page); pageNo++;
      page.rect(0, PH - 46, PW, 46, DARK);
      page.text('KÖRJOURNAL', M, PH - 30, 15, true, 'l', null, 1);
      page.text(meta.subtitle || '', M + textW('KÖRJOURNAL', 15, true) + 14, PH - 29, 9, false, 'l', 420, 0.85);
      page.text(meta.foretag || '', right, PH - 22, 8, false, 'r', 260, 0.85);
      page.text('Skapad ' + (meta.skapad || ''), right, PH - 34, 8, false, 'r', 260, 0.6);
      y = PH - 46 - 12;
      if (withTable === false) return;
      // rubrikrad – etiketter bryts på upp till två rader
      var hl = [], hfs = [], maxL = 1, c;
      for (c = 0; c < COLS.length; c++) {
        var bredd = w[c] - 2 * PAD, storlek = HFS;
        var langst = COLS[c].t.split(' ').reduce(function (a, o) {
          return textW(o, 1, true) > textW(a, 1, true) ? o : a;
        }, '');
        while (storlek > 4.5 && textW(langst, storlek, true) > bredd) storlek -= 0.2;
        hfs.push(storlek);
        var ls = wrap(COLS[c].t, bredd, storlek, true).slice(0, 2);
        hl.push(ls);
        if (ls.length > maxL) maxL = ls.length;
      }
      var hh = 8 + maxL * 7.6;
      page.rect(M, y - hh, right - M, hh, YELLOW);
      for (c = 0; c < COLS.length; c++) {
        var tx = COLS[c].a === 'r' ? xs[c] + w[c] - PAD : xs[c] + PAD;
        var top = y - hh + (hh - hl[c].length * 7.6) / 2 + hl[c].length * 7.6 - 6.2;
        for (var hi = 0; hi < hl[c].length; hi++) {
          page.text(hl[c][hi], tx, top - hi * 7.6, hfs[c], true, COLS[c].a || 'l', w[c] - 2 * PAD);
        }
      }
      y -= hh;
    }

    function footer(p, no, tot) {
      p.line(M, M + 16, right, M + 16, 0.8, 0.5);
      p.text(meta.footer || '', M, M + 6, 7, false, 'l', 420, 0.45);
      p.text('Sida ' + no + ' av ' + tot, right, M + 6, 7, false, 'r', 120, 0.45);
    }

    header();

    var totKm = 0, totTr = 0, totFuel = 0;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], cells = [], maxLines = 1;
      for (i = 0; i < COLS.length; i++) {
        var lines = wrap(row[COLS[i].k], w[i] - 2 * PAD, FS, false);
        if (lines.length > 3) lines = lines.slice(0, 3);
        cells.push(lines);
        if (lines.length > maxLines) maxLines = lines.length;
      }
      var rh = Math.max(14, maxLines * LH + 5);
      if (y - rh < M + 26) { header(); }
      if (r % 2 === 1) page.rect(M, y - rh, right - M, rh, GRAYF);
      for (i = 0; i < COLS.length; i++) {
        var cx = COLS[i].a === 'r' ? xs[i] + w[i] - PAD : xs[i] + PAD;
        for (var l = 0; l < cells[i].length; l++) {
          page.text(cells[i][l], cx, y - 9.2 - l * LH, FS, false, COLS[i].a || 'l', w[i] - 2 * PAD);
        }
      }
      page.line(M, y - rh, right, y - rh, 0.85, 0.4);
      y -= rh;
      totKm += Number(row._km) || 0;
      totTr += Number(row._trangsel) || 0;
      totFuel += Number(row._bransle) || 0;
    }

    /* summarad */
    if (y - 20 < M + 26) header();
    page.rect(M, y - 18, right - M, 18, DARK);
    page.text('TOTALT  ' + rows.length + ' resor', xs[0] + PAD, y - 12, 8, true, 'l', null, 1);
    page.text(String(totKm), rx('km'), y - 12, 8.5, true, 'r', null, 1);
    page.text('km', xs[ci('adressStart')] + PAD, y - 12, 7, false, 'l', null, 0.75);
    page.text(totTr ? fmtKr(totTr) : '', rx('trangsel'), y - 12, 8, true, 'r', null, 1);
    page.text(totFuel ? fmtKr(Math.round(totFuel)) : '', rx('bransle'), y - 12, 8, true, 'r', null, 1);
    y -= 18;

    /* sammanställning av ersättning */
    var sum = meta.summary || [];
    if (sum.length) {
      var need = 30 + sum.length * 15;
      if (y - need < M + 26) header(false);
      y -= 22;
      page.text('SAMMANSTÄLLNING', M, y, 9, true);
      y -= 4;
      var vx = M + 330;
      for (var s = 0; s < sum.length; s++) {
        var ln = sum[s];
        if (ln.rule) { page.line(M, y - 4, vx, y - 4, 0.7, 0.6); y -= 9; continue; }
        if (ln.head) { y -= 17; page.text(ln.head.toUpperCase(), M + 2, y, 7.5, true, 'l', 320, 0.45); continue; }
        if (ln.note) { y -= 13; page.text(ln.note, M + 2, y, 7.5, false, 'l', 320, 0.45); continue; }
        y -= 14;
        page.text(ln.label, M + 2, y, ln.bold ? 9 : 8.5, !!(ln.bold || ln.sub), 'l', 300);
        page.text(ln.value, vx, y, ln.bold ? 9 : 8.5, !!(ln.bold || ln.sub), 'r', 130);
        if (ln.sub) { page.line(M + 200, y + 11, vx, y + 11, 0.75, 0.4); }
      }
    }

    for (i = 0; i < pages.length; i++) footer(pages[i], i + 1, pages.length);

    return assemble(pages);
  }

  function fmtKr(v) {
    return (Math.round(v * 100) / 100).toString().replace('.', ',');
  }

  global.KJPdf = { build: build, fmtKr: fmtKr };

})(typeof window !== 'undefined' ? window : globalThis);
