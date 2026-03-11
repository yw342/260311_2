/**
 * Vercel 권장 형식: export default { fetch(request) }
 * 모든 응답은 반드시 new Response(JSON.stringify(...), { headers: { 'Content-Type': 'application/json' } })
 */

const BASE = 'https://www.mule.co.kr';
const MULE_MARKET = `${BASE}/bbs/market`;
const MULE_MARKET_SELL = `${BASE}/bbs/market/sell`;
const MULE_IN = `${BASE}/bbs/community/mulein`;
const FETCH_TIMEOUT_MS = 5500;
const CORS_PROXY = 'https://corsproxy.io/?url=';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function parsePrice(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, '').match(/\d+/);
  return m ? text.trim() : null;
}

function parseDate(text) {
  if (!text) return null;
  const s = String(text).trim();
  const y = new Date().getFullYear();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  if (/^(\d{2})-(\d{2})/.test(s)) return `${y}-${s.replace(/^(\d{2})-(\d{2})/, '$1-$2')}`;
  if (/^(\d{2})\/(\d{2})/.test(s)) return `${y}-${s.replace(/\//g, '-')}`;
  return null;
}

async function fetchMulePage(url, useProxy = false) {
  const target = useProxy ? CORS_PROXY + encodeURIComponent(url) : url;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(target, {
      headers: useProxy ? {} : { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      signal: c.signal,
    });
    if (!r.ok) return null;
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function extractFromLinks(html, sourceLabel, load) {
  const $ = load(html, { decodeEntities: false });
  const items = [];
  const seen = new Set();
  $('a[href*="idx="]').each((_, el) => {
    const $a = $(el);
    let href = $a.attr('href');
    if (!href || !href.includes('idx=')) return;
    href = href.replace(/&amp;/g, '&');
    const link = href.startsWith('http') ? href : new URL(href, BASE).href;
    if (!link.includes('mule.co.kr/bbs/') || seen.has(link)) return;
    seen.add(link);
    const raw = $a.text().trim().replace(/\s+/g, ' ');
    if (!raw || raw.length < 2) return;
    const priceM = raw.match(/^([\d.,]+(?:만원|원)|-\s*)/);
    const price = priceM ? priceM[1].trim() : parsePrice(raw) || null;
    const title = (priceM ? raw.slice(priceM[0].length) : raw).replace(/\s*\[\d+\]\s*$/, '').trim() || raw;
    items.push({ title, image_url: null, price, source_site: sourceLabel, source_url: link, posted_at: null });
  });
  return items;
}

const LEFTY = /왼손|레프티|lefty|좌손/i;
function filterLefty(items) {
  return items.filter((i) => LEFTY.test(i.title));
}

function extractList(html, sourceLabel, load) {
  const fromLinks = extractFromLinks(html, sourceLabel, load);
  if (fromLinks.length > 0) return filterLefty(fromLinks);
  const $ = load(html);
  const items = [];
  $('table tbody tr, .board-list tr, a[href*="idx="]').each((_, el) => {
    const $el = $(el);
    const $a = $el.is('a') ? $el : $el.find('a[href*="idx="]').first();
    const href = $a.attr('href');
    if (!href) return;
    const link = (href.startsWith('http') ? href : new URL(href.replace(/&amp;/g, '&'), BASE).href;
    const title = $a.text().trim().replace(/\s*\[\d+\]\s*$/, '');
    if (!title || title.length < 2) return;
    items.push({ title, image_url: null, price: parsePrice(title) || null, source_site: sourceLabel, source_url: link, posted_at: null });
  });
  return filterLefty(items);
}

async function crawlMule(load) {
  const out = [];
  const q = '왼손';
  const urls = [
    `${MULE_MARKET}?qs=${encodeURIComponent(q)}&page=1`,
    `${MULE_MARKET_SELL}?qs=${encodeURIComponent(q)}&page=1`,
    `${MULE_MARKET}?page=1`,
    `${MULE_IN}?qs=${encodeURIComponent(q)}&page=1&mode=list`,
  ];
  const seen = new Set();
  for (const url of urls) {
    for (const proxy of [false, true]) {
      try {
        const html = await fetchMulePage(url, proxy);
        if (html && html.length > 1000) {
          const list = extractList(html, '뮬(mule)', load);
          for (const i of list) {
            if (!seen.has(i.source_url)) {
              seen.add(i.source_url);
              out.push(i);
            }
          }
          if (out.length >= 20) return out;
        }
      } catch (_) {}
    }
  }
  return out;
}

export default {
  async fetch(request) {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS });
      }
      if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
      }

      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!url || !key) {
        return json({ error: 'Supabase가 설정되지 않았습니다. Vercel 환경 변수에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.' }, 500);
      }

      let createClient;
      try {
        const m = await import('@supabase/supabase-js');
        createClient = m.createClient;
      } catch (e) {
        return json({ error: 'Supabase 로드 실패: ' + (e && e.message ? e.message : '') }, 500);
      }

      let load;
      try {
        const m = await import('cheerio');
        load = m.load || m.default;
      } catch (e) {
        return json({ error: 'cheerio 로드 실패: ' + (e && e.message ? e.message : '') }, 500);
      }

      const supabase = createClient(url, key);
      let all = [];
      let err = null;
      try {
        all = await crawlMule(load);
      } catch (e) {
        err = e;
      }

      const seen = new Set();
      const unique = all.filter((i) => {
        if (seen.has(i.source_url)) return false;
        seen.add(i.source_url);
        return true;
      });

      for (const row of unique) {
        try {
          await supabase.from('listings').upsert(
            { title: row.title, image_url: row.image_url, price: row.price, source_site: row.source_site, source_url: row.source_url, posted_at: row.posted_at || null },
            { onConflict: 'source_url' }
          );
        } catch (_) {}
      }

      const message =
        unique.length > 0
          ? `${unique.length}건 수집 후 DB 반영 완료`
          : err
            ? `수집 0건. (${err.message || err}). 뮬 연결 불가 또는 HTML 구조 변경 가능.`
            : '수집된 매물이 없습니다. 잠시 후 다시 시도해 보세요.';

      return json({ ok: true, crawled: unique.length, message }, 200);
    } catch (e) {
      return json({ error: (e && e.message) || String(e) || '서버 오류' }, 500);
    }
  },
};
