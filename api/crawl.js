import { getSupabase } from '../lib/supabase.js';
import { setCors } from '../lib/res.js';
import * as cheerio from 'cheerio';

const BASE = 'https://www.mule.co.kr';
const MULE_MARKET = `${BASE}/bbs/market`;
const MULE_MARKET_SELL = `${BASE}/bbs/market/sell`;
const MULE_IN = `${BASE}/bbs/community/mulein`;
const FETCH_TIMEOUT_MS = 5500;
const CORS_PROXY = 'https://corsproxy.io/?url=';

function parsePrice(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, '').match(/\d+/);
  return m ? text.trim() : null;
}

function parseDate(text) {
  if (!text) return null;
  const s = String(text).trim();
  const today = new Date();
  const y = today.getFullYear();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  if (/^(\d{2})-(\d{2})/.test(s)) return `${y}-${s.replace(/^(\d{2})-(\d{2})/, '$1-$2')}`;
  if (/^(\d{2})\/(\d{2})/.test(s)) return `${y}-${s.replace(/\//g, '-')}`;
  return null;
}

async function fetchMulePage(url, useProxy = false) {
  const target = useProxy ? CORS_PROXY + encodeURIComponent(url) : url;
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      headers: useProxy
        ? {}
        : {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } finally {
    clearTimeout(to);
  }
}

/** 뮬 악기장터/뮬인: 링크 목록 형태 [가격+제목](url) 에 맞춰 추출 */
function extractMuleListFromLinks(html, sourceLabel) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const items = [];
  const seen = new Set();
  $('a[href*="idx="]').each((_, el) => {
    const $a = $(el);
    let href = $a.attr('href');
    if (!href || !href.includes('idx=')) return;
    href = href.replace(/&amp;/g, '&');
    const link = href.startsWith('http') ? href : new URL(href, BASE).href;
    if (!link.includes('mule.co.kr/bbs/')) return;
    if (seen.has(link)) return;
    seen.add(link);
    const rawText = $a.text().trim().replace(/\s+/g, ' ');
    if (!rawText || rawText.length < 2) return;
    const priceMatch = rawText.match(/^([\d.,]+(?:만원|원)|-\s*)/);
    const price = priceMatch ? priceMatch[1].trim() : parsePrice(rawText) || null;
    const title = priceMatch ? rawText.slice(priceMatch[0].length).trim() : rawText;
    const finalTitle = title.replace(/\s*\[\d+\]\s*$/, '').trim() || rawText;
    items.push({
      title: finalTitle,
      image_url: null,
      price,
      source_site: sourceLabel,
      source_url: link,
      posted_at: null,
    });
  });
  return items;
}

/** 왼손/레프티 관련만 필터 (제목에 키워드 포함) */
const LEFTY_KEYWORDS = /왼손|레프티|lefty|좌손/i;
function filterLeftyOnly(items) {
  return items.filter((i) => LEFTY_KEYWORDS.test(i.title));
}

function extractMuleList(html, sourceLabel) {
  const fromLinks = extractMuleListFromLinks(html, sourceLabel);
  if (fromLinks.length > 0) {
    return filterLeftyOnly(fromLinks);
  }
  const $ = cheerio.load(html);
  const items = [];
  const rows = $('table tbody tr, .board-list tr, .list-item, [class*="list"] tr, .market-list tr').toArray();
  for (const tr of rows) {
    const $tr = $(tr);
    const $a = $tr.find('a[href*="idx="], a[href*="/bbs/"]').first();
    const href = $a.attr('href');
    if (!href) continue;
    const link = (href.startsWith('http') ? href : new URL(href.replace(/&amp;/g, '&'), BASE).href;
    const title = $a.text().trim() || $tr.find('.title, .subject, td').first().text().trim();
    if (!title || title.length < 2) continue;
    const priceEl = $tr.find('.price, [class*="price"], td:nth-child(3), td:nth-child(4)');
    const price = parsePrice(priceEl.length ? priceEl.first().text() : '') || parsePrice(title);
    const dateEl = $tr.find('.date, .wdate, [class*="date"]');
    const rawDate = dateEl.length ? dateEl.first().text() : '';
    const postedAt = parseDate(rawDate);
    const img = $tr.find('img[src]').first().attr('src');
    const imageUrl = img ? (img.startsWith('http') ? img : new URL(img, BASE).href) : null;
    items.push({
      title,
      image_url: imageUrl,
      price: price || null,
      source_site: sourceLabel,
      source_url: link,
      posted_at: postedAt,
    });
  }
  if (items.length === 0) {
    $('a[href*="idx="]').each((_, a) => {
      const $a = $(a);
      let href = $a.attr('href');
      if (!href) return;
      href = href.replace(/&amp;/g, '&');
      const link = href.startsWith('http') ? href : new URL(href, BASE).href;
      const title = $a.text().trim().replace(/\s*\[\d+\]\s*$/, '');
      if (!title || title.length < 2) return;
      items.push({
        title,
        image_url: null,
        price: parsePrice(title) || null,
        source_site: sourceLabel,
        source_url: link,
        posted_at: null,
      });
    });
  }
  return filterLeftyOnly(items);
}

async function crawlMule() {
  const out = [];
  const q = '왼손';
  const urls = [
    `${MULE_MARKET}?qs=${encodeURIComponent(q)}&page=1`,
    `${MULE_MARKET_SELL}?qs=${encodeURIComponent(q)}&page=1`,
    `${MULE_MARKET}?page=1`,
    `${MULE_MARKET_SELL}?page=1`,
    `${MULE_IN}?qs=${encodeURIComponent(q)}&page=1&mode=list`,
  ];
  const seen = new Set();
  for (const url of urls) {
    for (const useProxy of [false, true]) {
      try {
        const html = await fetchMulePage(url, useProxy);
        if (html && html.length > 1000) {
          const list = extractMuleList(html, '뮬(mule)');
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

function sendJson(res, status, body) {
  setCors(res);
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    let supabase;
    try {
      supabase = getSupabase();
    } catch (e) {
      return sendJson(res, 500, {
        error: 'Supabase가 설정되지 않았습니다. Vercel 환경 변수에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.',
      });
    }

    let all = [];
    let crawlError = null;
    try {
      all = await crawlMule();
    } catch (e) {
      crawlError = e;
      console.error('Crawl mule error', e);
    }

    const seen = new Set();
    const unique = all.filter((i) => {
      if (seen.has(i.source_url)) return false;
      seen.add(i.source_url);
      return true;
    });

    for (const row of unique) {
      try {
        const { error } = await supabase.from('listings').upsert(
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
        if (error) console.error('Upsert error', row.source_url, error);
      } catch (e) {
        console.error('Upsert error', row.source_url, e);
      }
    }

    const message =
      unique.length > 0
        ? `${unique.length}건 수집 후 DB 반영 완료`
        : crawlError
          ? `수집 0건. (원인: ${crawlError.message}). 뮬 사이트 연결이 불가하거나 HTML 구조가 변경되었을 수 있습니다.`
          : '수집된 매물이 없습니다. 잠시 후 다시 시도하거나, 뮬에서 "왼손" 검색 결과가 있는지 확인해 보세요.';

    return sendJson(res, 200, {
      ok: true,
      crawled: unique.length,
      message,
    });
  } catch (e) {
    console.error('Crawl handler error', e);
    sendJson(res, 500, {
      error: e.message || '크롤링 중 서버 오류가 발생했습니다.',
    });
  }
}
