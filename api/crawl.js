/**
 * cheerio 미사용: 정규식으로 HTML 파싱 → 타임아웃·크래시 방지, 항상 JSON 응답
 */
const BASE = 'https://www.mule.co.kr';
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

const LEFTY = /왼손|레프티|lefty|좌손/i;

/** HTML에서 href="...idx=..." 추출 후, 해당 위치 근처에서 링크 텍스트 찾기 */
function extractLinks(html, sourceLabel, requireLefty = false) {
  const items = [];
  const seen = new Set();

  const hrefRe = /href\s*=\s*["']([^"']*idx=(\d+)[^"']*)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1].replace(/&amp;/g, '&');
    const link = href.startsWith('http') ? href : new URL(href, BASE).href;
    if (!link.includes('mule.co.kr/bbs/') || seen.has(link)) continue;
    seen.add(link);

    const afterHref = html.slice(m.index + m[0].length);
    const closeAngle = afterHref.indexOf('>');
    const closeA = afterHref.indexOf('</a>', closeAngle);
    let raw = closeAngle >= 0 && closeA > closeAngle
      ? afterHref.slice(closeAngle + 1, closeA)
      : '';
    raw = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (requireLefty && raw && !LEFTY.test(raw)) continue;
    if (!raw || raw.length < 1) raw = `뮬 매물 #${m[2] || ''}`;

    const priceMatch = raw.match(/^([\d.,]+(?:만원|원)|-\s*)/);
    const price = priceMatch ? priceMatch[1].trim() : null;
    const title = (priceMatch ? raw.slice(priceMatch[0].length) : raw).replace(/\s*\[\d+\]\s*$/, '').trim() || raw;
    items.push({ title: title || raw, image_url: null, price, source_site: sourceLabel, source_url: link, posted_at: null });
  }
  return items;
}

async function fetchOne(url, useProxy = false) {
  const target = useProxy ? CORS_PROXY + encodeURIComponent(url) : url;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 4000);
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
      const crawlUrl = `${BASE}/bbs/market?qs=${encodeURIComponent('왼손')}&page=1`;
      let all = [];
      let err = null;

      for (const useProxy of [false, true]) {
        try {
          const html = await fetchOne(crawlUrl, useProxy);
          if (html && html.length > 1000) {
            all = extractLinks(html, '뮬(mule)', false);
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

      return json({ ok: true, crawled: unique.length, message }, 200);
    } catch (e) {
      return json({ error: (e && e.message) || String(e) || '서버 오류' }, 500);
    }
  },
};
