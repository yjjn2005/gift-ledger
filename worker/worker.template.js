// 축의금 장부 Worker — 앱 HTML 제공 + PIN 보호 API (KV 저장)
__LOGIC__
const HTML = __HTML__;
const J = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const USER = { email: '가족', role: 'admin' };
async function load(env) {
  const raw = await env.GIFT_KV.get('ledger', 'json');
  return raw || { state: emptyState(), revision: 0 };
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) {
      return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
    }
    if (req.headers.get('x-pin') !== env.PIN) return J({ error: 'PIN이 올바르지 않습니다. 새로고침 후 다시 입력해 주세요.' }, 401);
    try {
      if (url.pathname === '/api/state' && req.method === 'GET') {
        const cur = await load(env);
        return J({ state: cur.state, revision: cur.revision, user: USER });
      }
      if (url.pathname === '/api/operations' && req.method === 'POST') {
        const op = await req.json();
        const cur = await load(env);
        const applied = applyOperation(cur.state, op, USER.email);
        const packet = { state: applied.state, revision: cur.revision + (applied.replayed ? 0 : 1) };
        if (!applied.replayed) await env.GIFT_KV.put('ledger', JSON.stringify(packet));
        return J(packet);
      }
      if (url.pathname === '/api/restore' && req.method === 'POST') {
        const body = await req.json();
        const cur = await load(env);
        if (body.expectedRevision !== cur.revision) throw new AppError('다른 기기에서 기록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.', 409);
        validateState(body.state);
        const restored = structuredClone(body.state);
        restored.audit.push({ operationId: id(), action: 'restore', actor: USER.email, at: new Date().toISOString(), before: { revision: cur.revision }, after: { receipts: restored.receipts.length } });
        validateState(restored);
        const packet = { state: restored, revision: cur.revision + 1 };
        await env.GIFT_KV.put('ledger', JSON.stringify(packet));
        return J(packet);
      }
      return J({ error: '지원하지 않는 요청입니다.' }, 404);
    } catch (e) {
      return J({ error: e.message || '처리 중 오류가 발생했습니다.' }, e.status || 500);
    }
  }
};
