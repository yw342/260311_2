/** 연결 확인: 항상 JSON 반환. 이 API가 JSON이면 Vercel 함수 형식은 정상. */
export default {
  fetch() {
    return new Response(JSON.stringify({ ok: true, msg: 'pong' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
