/* Skickar körjournalen som mejl med PDF-bifogad.
 *
 * Mottagaren ligger i miljövariabeln TO_EMAIL, inte i anropet – den som
 * hittar adressen till funktionen kan alltså bara skicka en körjournal
 * till er egen inkorg, inte använda den för att mejla vem som helst.
 *
 * Hemligheter sätts med wrangler, aldrig i koden:
 *   npx wrangler secret put RESEND_API_KEY
 */

const MAX_PDF = 8 * 1024 * 1024;   // 8 MB base64

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return svar({ error: 'Endast POST' }, 405, cors);

    if (origin !== '*') {
      const fran = request.headers.get('Origin');
      if (fran && fran !== origin) return svar({ error: 'Fel avsändare' }, 403, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return svar({ error: 'Ogiltig begäran' }, 400, cors);
    }

    const pdf = typeof data.pdf === 'string' ? data.pdf : '';
    if (!pdf) return svar({ error: 'Ingen PDF med i anropet' }, 400, cors);
    if (pdf.length > MAX_PDF) return svar({ error: 'PDF:en är för stor' }, 413, cors);

    const filnamn = String(data.filename || 'korjournal.pdf').replace(/[^\w\s.\-åäöÅÄÖ]/g, '');
    const brodtext = String(data.text || '').slice(0, 20000);

    const resend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [env.TO_EMAIL],
        subject: 'KÖRJOURNAL',
        text: brodtext,
        attachments: [{ filename: filnamn, content: pdf }]
      })
    });

    if (!resend.ok) {
      const fel = await resend.text();
      return svar({ error: 'Mejlet gick inte iväg', detalj: fel.slice(0, 300) }, 502, cors);
    }

    return svar({ ok: true, till: env.TO_EMAIL }, 200, cors);
  }
};

function svar(kropp, status, cors) {
  return new Response(JSON.stringify(kropp), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
