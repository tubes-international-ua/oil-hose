/**
 * Cloudflare Worker — static assets + lead form handler.
 * Static files live in public/ and are served from the ASSETS binding;
 * only POST /api/lead is handled by this script.
 *
 * Required environment variables (Worker → Settings → Variables and Secrets):
 *   RESEND_API_KEY  — API key from resend.com
 *   MAIL_FROM       — verified sender, e.g. "Лендінг <lead@your-domain.com.ua>"
 * Optional:
 *   MAIL_BCC        — extra address that receives a copy of every lead
 *   MAIL_TO         — send every lead here instead of the routed branch. Meant for
 *                     testing the delivery chain; unset it to restore branch routing.
 */

const BRANCHES = {
  lviv:   { email: 'lviv@tubes-international.com',   label: 'Львів'  },
  kyiv:   { email: 'kyiv@tubes-international.com',   label: 'Київ'   },
  dnipro: { email: 'dnipro@tubes-international.com', label: 'Дніпро' },
};

// Oblast-level routing: a lead from any of these regions goes to the nearest branch.
const REGIONS = {
  lviv: ['львів', 'lviv', 'львов', 'івано-франків', 'ivano', 'тернопіл', 'ternopil', 'ужгород', 'uzhhorod',
         'закарпат', 'луцьк', 'lutsk', 'волин', 'рівне', 'rivne', 'чернівц', 'chernivtsi', 'дрогобич',
         'стрий', 'мукачев', 'калуш', 'коломия'],
  kyiv: ['київ', 'киев', 'kyiv', 'kiev', 'житомир', 'zhytomyr', 'черкас', 'cherkas', 'чернігів', 'chernihiv',
         'вінниц', 'vinnyts', 'хмельницьк', 'khmelnyts', 'суми', 'sumy', 'полтав', 'poltav', 'біла церква',
         'бровар', 'ірпінь', 'буча', 'умань'],
  dnipro: ['дніпро', 'днепр', 'dnipro', 'dnepr', 'запоріж', 'zaporiz', 'харків', 'kharkiv', 'харьков',
           'одес', 'odes', 'микола', 'mykola', 'херсон', 'kherson', 'кривий ріг', 'кривой рог', 'kryvyi',
           'кропивниц', 'kropyvnyts', 'маріупол', 'нікополь', 'павлоград', 'кам\'янське', 'мелітопол'],
};

const DEFAULT_BRANCH = 'lviv';

/** Pick the branch whose region list matches the city the visitor typed. */
function routeCity(city) {
  const c = (city || '').toLowerCase().trim();
  for (const [branch, keys] of Object.entries(REGIONS)) {
    if (keys.some((k) => c.includes(k))) return { branch, matched: true };
  }
  return { branch: DEFAULT_BRANCH, matched: false };
}

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function validate(d) {
  const errors = [];
  if (!d.name || String(d.name).trim().length < 2) errors.push('name');
  if (!d.city || String(d.city).trim().length < 2) errors.push('city');
  if (String(d.phone || '').replace(/\D/g, '').length < 10) errors.push('phone');
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(d.email || '').trim())) errors.push('email');
  if (d.consent !== true) errors.push('consent');
  return errors;
}

function buildHtml(d, branch, matched, meta) {
  const hasUtm = d.utm && typeof d.utm === 'object' && !Array.isArray(d.utm) && Object.keys(d.utm).length;
  const utm = hasUtm
    ? Object.entries(d.utm).map(([k, v]) => `${esc(k)}=${esc(v)}`).join('<br>')
    : '—';
  const row = (k, v) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#667;white-space:nowrap;vertical-align:top">${k}</td>` +
    `<td style="padding:6px 0;color:#111"><b>${v}</b></td></tr>`;

  return `<!DOCTYPE html><html lang="uk"><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111">
<h2 style="margin:0 0 4px">Заявка з лендінгу композитних рукавів</h2>${
    meta.routedTo
      ? `<p style="margin:0 0 10px;padding:8px 12px;background:#fff4d6;border:1px solid #e8c65a;color:#7a5b00">
<b>Тестовий режим.</b> Заявка перенаправлена сюди через змінну <code>MAIL_TO</code>.
За звичайних умов пішла б на <b>${esc(BRANCHES[branch].email)}</b>.</p>`
      : ''}
<p style="margin:0 0 18px;color:#667">Філія: <b>${esc(BRANCHES[branch].label)}</b>${
    matched ? '' : ' <span style="color:#c00">(місто не розпізнано — перевірте, чи ваша це заявка)</span>'}</p>
<table style="border-collapse:collapse">
${row('Ім’я', esc(d.name))}
${row('Телефон', `<a href="tel:${esc(String(d.phone).replace(/[^\d+]/g, ''))}">${esc(d.phone)}</a>`)}
${row('Email', `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`)}
${row('Місто', esc(d.city))}
${row('Задача', esc(d.message) || '—')}
</table>
<h3 style="margin:22px 0 6px;font-size:14px;color:#667">Джерело</h3>
<table style="border-collapse:collapse;font-size:13px;color:#667">
${row('Сторінка', esc(d.page_url))}
${row('Мітки', utm)}
${row('Отримано', esc(meta.time))}
${row('IP / країна', `${esc(meta.ip)} / ${esc(meta.country)}`)}
</table>
</body></html>`;
}

async function handleLead(request, env) {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });

  let d;
  try {
    d = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  // Honeypot: a filled hidden field means a bot. Answer 200 so it does not retry.
  if (d.company_url) return json({ ok: true });

  const errors = validate(d);
  if (errors.length) return json({ ok: false, error: 'validation', fields: errors }, 422);

  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    console.error('RESEND_API_KEY or MAIL_FROM is not configured');
    return json({ ok: false, error: 'not_configured' }, 500);
  }

  const { branch, matched } = routeCity(d.city);
  const override = String(env.MAIL_TO || '').trim();
  const meta = {
    time: new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
    ip: request.headers.get('CF-Connecting-IP') || '—',
    country: request.cf?.country || '—',
    routedTo: override ? branch : null,
  };

  const payload = {
    from: env.MAIL_FROM,
    to: [override || BRANCHES[branch].email],
    reply_to: String(d.email).trim(),
    subject: `Заявка: композитні рукави — ${String(d.city).trim()} (${String(d.name).trim()})`,
    html: buildHtml(d, branch, matched, meta),
  };
  if (env.MAIL_BCC) payload.bcc = [env.MAIL_BCC];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return json({ ok: false, error: 'send_failed' }, 502);
  }

  return json({ ok: true, branch, ...(override ? { test_mode: true } : {}) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
      }
      return handleLead(request, env);
    }

    // Everything else is a static file (index.html, /assets/*, /images/*, robots.txt).
    return env.ASSETS.fetch(request);
  },
};
