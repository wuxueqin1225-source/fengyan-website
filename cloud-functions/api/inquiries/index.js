/**
 * 峰妍新材料官网 - 询盘导出（EdgeOne Makers Cloud Functions）
 *
 * 用法：GET /api/inquiries?token=<ADMIN_TOKEN>[&date=20260830][&limit=50][&format=csv]
 *   date   可传 8 位（当天）或 6 位（当月），留空则查全部
 *   limit  最多返回条数，默认 50，上限 256
 *   format 传 csv 时直接下载表格，否则返回 JSON
 *
 * 安全：必须先在环境变量配置 ADMIN_TOKEN，未配置时接口一律拒绝（fail closed）。
 * 该接口会返回客户手机号，切勿把 token 写进前端代码或提交到 Git。
 */
const KV = typeof inquiry_kv !== 'undefined' ? inquiry_kv : null;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
  });
}

function env(context, key) {
  const bag = (context && context.env) || {};
  const val = bag[key];
  return val !== undefined && val !== '' ? val : (process.env[key] || '');
}

function csvCell(v) {
  const s = String(v === null || v === undefined ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const COLUMNS = [
  ['id', '存档编号'],
  ['created_at', '提交时间'],
  ['name', '姓名/公司'],
  ['phone', '电话/微信'],
  ['products', '意向产品'],
  ['description', '需求描述']
];

function toCsv(rows) {
  const head = COLUMNS.map(([, label]) => csvCell(label)).join(',');
  const body = rows.map((r) => COLUMNS.map(([k]) => csvCell(r[k])).join(',')).join('\r\n');
  return '\uFEFF' + head + '\r\n' + body;
}

async function listKeys(prefix) {
  let keys = [];
  let cursor;
  do {
    const page = await KV.list({ prefix, limit: 256, ...(cursor ? { cursor } : {}) });
    keys = keys.concat((page.keys || []).map((k) => k.key));
    cursor = page.cursor;
  } while (cursor && keys.length < 1024);
  return keys.sort();
}

export async function onRequest(context) {
  const req = context.request;

  /* 204 响应不允许带 body，必须传 null */
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'GET') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405);
  }

  const expected = env(context, 'ADMIN_TOKEN');
  if (!expected) {
    return json({ ok: false, error: '未配置 ADMIN_TOKEN，接口已关闭' }, 503);
  }

  const url = new URL(req.url);
  if (url.searchParams.get('token') !== expected) {
    return json({ ok: false, error: '未授权' }, 401);
  }
  if (!KV) {
    return json({ ok: false, error: '未绑定 KV 命名空间 inquiry_kv' }, 500);
  }

  const date = (url.searchParams.get('date') || '').replace(/[^0-9]/g, '');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 256);
  const prefix = 'inq_' + date;

  let keys;
  try {
    keys = await listKeys(prefix);
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }

  /* key 字典序即时间升序，取尾部即为最新 */
  const picked = keys.slice(-limit).reverse();

  const rows = [];
  for (const key of picked) {
    try {
      const raw = await KV.get(key);
      if (!raw) continue;
      const rec = typeof raw === 'string' ? JSON.parse(raw) : raw;
      rows.push({ ...rec, id: key });
    } catch (e) {
      rows.push({ id: key, parse_error: String((e && e.message) || e) });
    }
  }

  if (url.searchParams.get('format') === 'csv') {
    return new Response(toCsv(rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inquiries_${date || 'all'}.csv"`,
        ...CORS
      }
    });
  }

  return json({ ok: true, total: keys.length, returned: rows.length, rows });
}
