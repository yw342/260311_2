export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function setCors(res) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  return res;
}
