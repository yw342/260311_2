/**
 * cheerio 미사용: 정규식으로 HTML 파싱 → 타임아웃·크래시 방지, 항상 JSON 응답
 */
const BASE = 'https://www.mule.co.kr';
const CORS_PROXY = 'https://corsproxy.io/?url=';

/** 뮬 악기장터 '왼손' 검색 + 일렉기타 카테고리 (실제 검색 URL) */
const MULE_LEFTY_SEARCH =
  BASE + '/bbs/market/sell?page=1&map=list&mode=list&region=&start_price=&end_price=&qf=title&qs=' +
  encodeURIComponent('왼손') +
  '&category=&ct1=' + encodeURIComponent('일렉기타') + '&ct2=' + encodeURIComponent('일렉기타') +
  '&ct3=&store=&options=&soldout=&sell_status=&sido=&gugun=&dong=&period=&of=wdate&od=&andor=and&v=l';
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

const SELL_BASE = `${BASE}/bbs/market/sell`;

/**
 * 뮬 중고장터 구조 (확인된 패턴):
 * - [가격+제목 [n]](https://.../sell?v=v&idx=숫자&...)
 * - HTML: <a href=".../sell?v=v&idx=숫자...">가격+제목 [n]</a>
 * 서버가 받는 응답이 SPA/다른 구조일 수 있으므로 여러 전략 사용.
 */
function extractLinks(html, sourceLabel) {
  const items = [];
  const seen = new Set();

  // 전략 1: 마크다운 스타일 [텍스트](url) — 일부 변환기/응답 형식
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)]*\/bbs\/market\/sell[^)]*idx=\d+[^)]*)\)/g;
  let m;
  while ((m = mdRe.exec(html)) !== null) {
    let link = m[2].replace(/&amp;/g, '&');
    if (!link.startsWith('http')) link = new URL(link, BASE).href;
    if (seen.has(link)) continue;
    seen.add(link);
    let raw = (m[1] || '').replace(/\s+/g, ' ').trim();
    if (!raw) raw = `뮬 매물`;
    const priceMatch = raw.match(/^([\d.,]+(?:만원|원)|-\s*)/);
    const price = priceMatch ? priceMatch[1].trim() : null;
    const title = (priceMatch ? raw.slice(priceMatch[0].length) : raw).replace(/\s*\[\d+\]\s*$/, '').trim() || raw;
    items.push({ title: title || raw, image_url: null, price, source_site: sourceLabel, source_url: link, posted_at: null });
  }
  if (items.length > 0) return items;

  // 전략 2: HTML href="...idx=..." 그 다음 > 와 </a> 사이 텍스트
  const hrefRe = /href\s*=\s*["']([^"']*idx=(\d+)[^"']*)["']/gi;
  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1].replace(/&amp;/g, '&');
    const link = href.startsWith('http') ? href : new URL(href, BASE).href;
    if (!link.includes('/bbs/market/sell') || seen.has(link)) continue;
    seen.add(link);
    const after = html.slice(m.index + m[0].length);
    const gt = after.indexOf('>');
    const endA = after.indexOf('</a>', gt);
    let raw = gt >= 0 && endA > gt ? after.slice(gt + 1, endA) : '';
    raw = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!raw) raw = `뮬 매물 #${m[2]}`;
    const priceMatch = raw.match(/^([\d.,]+(?:만원|원)|-\s*)/);
    const price = priceMatch ? priceMatch[1].trim() : null;
    const title = (priceMatch ? raw.slice(priceMatch[0].length) : raw).replace(/\s*\[\d+\]\s*$/, '').trim() || raw;
    items.push({ title: title || raw, image_url: null, price, source_site: sourceLabel, source_url: link, posted_at: null });
  }
  if (items.length > 0) return items;

  // 전략 3: market/sell...idx=숫자
  const idxRe = /(?:market\/sell|sell\?)[^"'\s]*idx=(\d+)/gi;
  while ((m = idxRe.exec(html)) !== null) {
    const id = m[1];
    const link = `${SELL_BASE}?v=v&idx=${id}&page=&qf=&q=`;
    if (seen.has(link)) continue;
    seen.add(link);
    items.push({ title: `뮬 매물 #${id}`, image_url: null, price: null, source_site: sourceLabel, source_url: link, posted_at: null });
  }
  if (items.length > 0) return items;

  // 전략 4: HTML 어디든 idx=숫자(5~8자리) 등장하면 매물로 간주 (게시글 ID 패턴)
  const anyIdxRe = /idx=(\d{5,8})(?=[&\s"'\n>]|$)/g;
  while ((m = anyIdxRe.exec(html)) !== null) {
    const id = m[1];
    const link = `${SELL_BASE}?v=v&idx=${id}&page=&qf=&q=`;
    if (seen.has(link)) continue;
    seen.add(link);
    items.push({ title: `뮬 매물 #${id}`, image_url: null, price: null, source_site: sourceLabel, source_url: link, posted_at: null });
  }
  return items;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: BASE + '/',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

async function fetchOne(url, useProxy = false) {
  const target = useProxy ? CORS_PROXY + encodeURIComponent(url) : url;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(target, {
      headers: useProxy ? {} : BROWSER_HEADERS,
      signal: c.signal,
    });
    if (!r.ok) return null;
    return await r.text();
  } finally {
    clearTimeout(t);
  }
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

      const supabase = createClient(url, key);
      let all = [];
      let err = null;
      let lastHtmlLength = 0;
      let lastSnippet = '';

      for (const useProxy of [false, true]) {
        try {
          const html = await fetchOne(MULE_LEFTY_SEARCH, useProxy);
          if (html && html.length > 100) {
            lastHtmlLength = html.length;
            lastSnippet = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
            all = extractLinks(html, '뮬(mule)');
            if (all.length > 0) break;
          }
        } catch (e) {
          err = e;
        }
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
            {
              title: row.title,
              image_url: row.image_url,
              price: row.price,
              source_site: row.source_site,
              source_url: row.source_url,
              posted_at: row.posted_at || null,
            },
            { onConflict: 'source_url' }
          );
        } catch (_) {}
      }

      const message =
        unique.length > 0
          ? `${unique.length}건 수집 후 DB 반영 완료`
          : err
            ? `수집 0건. (${err.message || err}). 뮬 연결 불가 또는 응답 구조 변경 가능.`
            : '수집된 매물이 없습니다. 잠시 후 다시 시도해 보세요.';

      const body = { ok: true, crawled: unique.length, message };
      if (unique.length === 0) {
        body.debug = {
          htmlLength: lastHtmlLength,
          snippet: lastSnippet || '(없음)',
          fetchError: err ? (err.message || String(err)) : null,
        };
      }
      return json(body, 200);
    } catch (e) {
      return json({ error: (e && e.message) || String(e) || '서버 오류' }, 500);
    }
  },
};
