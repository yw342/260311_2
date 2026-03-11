// Vercel Web Handler: Request → Response

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, image_url, price, source_site, source_url, posted_at, created_at')
      .order('posted_at', { ascending: false, nullsFirst: false });

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse(data || [], 200);
  } catch (e) {
    return jsonResponse({ error: (e && e.message) || '목록 조회 실패' }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
