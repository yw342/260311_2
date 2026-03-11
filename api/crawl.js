import { getSupabase } from '../lib/supabase.js';
import * as cheerio from 'cheerio';

const BASE = 'https://www.mule.co.kr';
const MULE_SEARCH = `${BASE}/bbs/market`;
const MULE_IN = `${BASE}/bbs/community/mulein`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

async function fetchMulePage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  return res.text();
}

function extractMuleList(html, sourceLabel) {
  const $ = cheerio.load(html);
  const items = [];
  const rows = $('table tbody tr, .board-list tr, .list-item, [class*="list"] tr, .market-list tr').toArray();
  for (const tr of rows) {
    const $tr = $(tr);
    const $a = $tr.find('a[href*="idx="], a[href*="/bbs/"]').first();
    const href = $a.attr('href');
    if (!href) continue;
    const link = href.startsWith('http') ? href : new URL(href, BASE).href;
    const title = $a.text().trim() || $tr.find('.title, .subject, td').first().text().trim();
    if (!title || title.length < 2) continue;
    const priceEl = $tr.find('.price, [class*="price"], td:nth-child(3), td:nth-child(4)');
    const price = parsePrice(priceEl.length ? priceEl.first().text() : '');
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
    const links = $('a[href*="idx="]').toArray();
    for (const a of links.slice(0, 30)) {
      const $a = $(a);
      const href = $a.attr('href');
      const title = $a.text().trim();
      if (!href || !title || title.length < 2) continue;
      const link = href.startsWith('http') ? href : new URL(href, BASE).href;
      const row = $a.closest('tr');
      const price = parsePrice(row.find('td').eq(2).text() || row.find('.price').text());
      const rawDate = row.find('.date, .wdate, td').last().text();
      items.push({
        title,
        image_url: row.find('img').attr('src') ? new URL(row.find('img').attr('src'), BASE).href : null,
        price,
        source_site: sourceLabel,
        source_url: link,
        posted_at: parseDate(rawDate),
      });
    }
  }
  return items;
}

async function crawlMule() {
  const out = [];
  const queries = ['왼손', '레프티', 'lefty'];
  for (const q of queries) {
    try {
      const url = `${MULE_SEARCH}?qs=${encodeURIComponent(q)}&page=1&of=wdate&od=desc`;
      const html = await fetchMulePage(url);
      if (html) {
        const list = extractMuleList(html, '뮬(mule)');
        list.forEach((i) => out.push(i));
      }
    } catch (_) {}
    try {
      const url2 = `${MULE_IN}?qs=${encodeURIComponent(q)}&page=1&of=wdate&od=desc&mode=list`;
      const html2 = await fetchMulePage(url2);
      if (html2) {
        const list = extractMuleList(html2, '뮬(mule)');
        list.forEach((i) => out.push(i));
      }
    } catch (_) {}
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.setHeaders(cors).status(405).json({ error: 'Method not allowed' });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    return res.setHeaders(cors).status(500).json({ error: 'Supabase not configured' });
  }

  const all = [];
  try {
    const muleItems = await crawlMule();
    all.push(...muleItems);
  } catch (e) {
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
    } catch (e) {
      console.error('Upsert error', row.source_url, e);
    }
  }

  return res.setHeaders(cors).status(200).json({
    ok: true,
    crawled: unique.length,
    message: `${unique.length}건 수집 후 DB 반영 완료`,
  });
}
