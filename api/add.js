// 수동 매물 추가 (POST): title, source_url 필수. price, source_site 선택

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ error: 'POST만 가능합니다.' }, 405);
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return json({ error: 'Supabase가 설정되지 않았습니다.' }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: 'JSON 본문이 필요합니다.' }, 400);
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const source_url = typeof body.source_url === 'string' ? body.source_url.trim() : '';
    if (!title || !source_url) {
      return json({ error: 'title과 source_url을 입력해 주세요.' }, 400);
    }

    // URL 형식 검사
    try {
      new URL(source_url);
    } catch (_) {
      return json({ error: '올바른 URL을 입력해 주세요.' }, 400);
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(url, key);
      const { data, error } = await supabase
        .from('listings')
        .upsert(
          {
            title,
            source_url,
            source_site: body.source_site || '뮬(mule)',
            price: body.price || null,
            image_url: body.image_url || null,
            posted_at: body.posted_at || null,
          },
          { onConflict: 'source_url' }
        )
        .select('id, title, source_url')
        .single();

      if (error) {
        return json({ error: error.message }, 500);
      }
      return json({ ok: true, message: '매물이 추가되었습니다.', data }, 200);
    } catch (e) {
      return json({ error: (e && e.message) || '추가 실패' }, 500);
    }
  },
};
