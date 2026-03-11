import { setCors } from '../lib/res.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const hasUrl = Boolean(url && url.startsWith('https://'));
  const hasKey = Boolean(key && key.length > 50);

  if (!hasUrl || !hasKey) {
    return res.status(200).json({
      ok: false,
      supabase: 'not_configured',
      message: 'SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_ANON_KEY)가 설정되지 않았습니다. SUPABASE_SETUP.md를 참고하세요.',
      env: { hasUrl, hasKey },
    });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key);
    const { count, error } = await supabase.from('listings').select('*', { count: 'exact', head: true });
    if (error) {
      return res.status(200).json({
        ok: false,
        supabase: 'connected_but_error',
        message: 'Supabase 연결됐으나 테이블 조회 실패. schema.sql을 SQL Editor에서 실행했는지 확인하세요.',
        error: error.message,
      });
    }
    return res.status(200).json({
      ok: true,
      supabase: 'connected',
      message: `Supabase 연동 정상. 현재 매물 ${count ?? 0}건.`,
      count: count ?? 0,
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      supabase: 'error',
      message: e.message || 'Supabase 연결 확인 중 오류',
    });
  }
}
