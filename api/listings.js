import { createClient } from '@supabase/supabase-js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.setHeaders(cors).status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.setHeaders(cors).status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, image_url, price, source_site, source_url, posted_at, created_at')
    .order('posted_at', { ascending: false, nullsFirst: false });

  if (error) {
    return res.setHeaders(cors).status(500).json({ error: error.message });
  }
  return res.setHeaders(cors).status(200).json(data || []);
}
