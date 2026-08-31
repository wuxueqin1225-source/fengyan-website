/**
 * 峰妍新材料官网 - 询盘提交（Cloudflare Pages Functions）
 *
 * 为什么不用 nodemailer：Cloudflare Pages Functions 跑在 Workers 运行时（V8 isolate），
 * 没有 Node 的 net / tls / dns 模块，nodemailer 无法建立 SMTP 连接，即使开 nodejs_compat 也不行。
 * 因此改用 Resend 的 HTTP API —— 纯 fetch 调用，Workers 原生支持，无第三方依赖。
 *
 * 环境变量（Cloudflare Pages → 项目 → 设置 → 环境变量，生产/预览分别配置）：
 *   RESEND_API_KEY   必填。Resend 后台创建，形如 re_xxxxxxxx
 *   MAIL_FROM        必填。发件地址，其域名必须已在 Resend 完成 DNS 验证
 *   NOTIFY_EMAIL     必填。收件邮箱，多个用英文逗号分隔
 *   ADMIN_TOKEN      可选。配置后启用 /api/inquiries 导出接口
 *
 * 安全加固（2026-08-31）：
 *   1. CORS 白名单 —— 只放行自家域名，杜绝第三方站点盗用接口
 *   2. IP 频率限制 —— 防脚本刷量耗尽 Resend 额度
 *   3. 输入校验 —— 手机号格式、字段长度、必填校验
 *
 * 可选存档：绑定 KV 命名空间（变量名 INQUIRY_KV）后自动写一份备份；
 * 不绑定则纯邮件运行，不依赖任何数据库。
 */

/* ============ 安全配置 ============ */

/** 允许调用接口的来源。浏览器跨站请求必带 Origin，不在列表内一律拒绝。 */
const ALLOWED_ORIGINS = [
  'https://www.fengyanpigment.com',
  'https://fengyanpigment.com',
  'https://fengyan-website.pages.dev'
];

/** 频率限制：同一 IP 在窗口期内允许的提交次数 */
const RATE_LIMIT = { windowMs: 3600 * 1000, max: 5 };

/* ============ 频率限制 ============ */

/**
 * 基于内存的滑动窗口计数。
 *
 * 说明：Workers 会在多个 isolate / 多地边缘节点并行运行，每个实例独立计数，
 * 所以这是「近似限流」——单实例能挡住高频脚本，跨地域分布式攻击需要上
 * Cloudflare WAF Rate Limiting 规则才能彻底解决。对本站的询盘量而言足够。
 */
const hits = new Map();

function rateCheck(ip) {
  const now = Date.now();

  /* 条目过多时清理过期记录，防止 Map 无限增长 */
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (now - v.start > RATE_LIMIT.windowMs) hits.delete(k);
    }
  }

  const rec = hits.get(ip);
  if (!rec || now - rec.start > RATE_LIMIT.windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT.max - 1, retryAfter: 0 };
  }

  rec.count += 1;
  if (rec.count > RATE_LIMIT.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((RATE_LIMIT.windowMs - (now - rec.start)) / 1000)
    };
  }
  return { allowed: true, remaining: RATE_LIMIT.max - rec.count, retryAfter: 0 };
}

/* ============ CORS ============ */

/**
 * 按请求来源生成 CORS 头。
 * - 白名单内：回显该 Origin
 * - 无 Origin（curl、服务端调用、同源）：放行，方便联调
 * - 不在白名单：不返回 Allow-Origin，浏览器会直接拦截
 */
function corsFor(origin) {
  const base = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (!origin) return { ...base, 'Access-Control-Allow-Origin': '*' };
  if (ALLOWED_ORIGINS.includes(origin)) {
    return { ...base, 'Access-Control-Allow-Origin': origin };
  }
  return base;
}

function json(body, status = 200, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
  });
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const pad = (n) => String(n).padStart(2, '0');

/* 北京时间可读时间，Resend 那边收到的是 UTC */
function bjTime(iso) {
  const t = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

function makeKey(ts) {
  const t = new Date(ts + 8 * 3600 * 1000);
  const d = `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`;
  const c = `${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, '0');
  return `inq_${d}_${c}_${rand}`;
}

function buildHtml(rec) {
  return `
  <div style="font-family:'Microsoft YaHei',sans-serif;max-width:560px;margin:0 auto;border:1px solid #eee;border-radius:6px;overflow:hidden">
    <div style="background:#0A0A0B;padding:18px 24px;color:#fff">
      <span style="font-size:17px;font-weight:bold;font-family:Georgia,serif">Fengyan®</span>
      <span style="color:#FF9999;font-size:13px;margin-left:10px">峰妍新材料 · 新询盘通知</span>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1E1E1F">
        <tr><td style="padding:8px 12px;background:#F5F5F4;width:96px;font-weight:600">姓名/公司</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(rec.name)}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F4;font-weight:600">电话/微信</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(rec.phone)}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F4;font-weight:600">意向产品</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(rec.products) || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F4;font-weight:600">需求描述</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(rec.description) || '—'}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F4;font-weight:600">提交时间</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${bjTime(rec.created_at)}（北京时间）</td></tr>
      </table>
      <p style="font-size:12px;color:#9E9E9E;margin-top:16px">收到后请尽快联系客户。编号 ${esc(rec.id)}。</p>
    </div>
  </div>`;
}

async function sendMail(env, rec) {
  const key = env.RESEND_API_KEY;
  const from = env.MAIL_FROM;
  const to = String(env.NOTIFY_EMAIL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!key || !from || !to.length) {
    return { status: 'skipped', reason: 'RESEND_API_KEY / MAIL_FROM / NOTIFY_EMAIL 未配置完整' };
  }

  /* 允许 MAIL_FROM 直接写成 "峰妍新材料 <notify@fengyanpigment.com>" 的完整格式 */
  const fromHeader = /</.test(from) ? from : `峰妍新材料官网 <${from}>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromHeader,
        to,
        subject: `【新询盘】${rec.name} 咨询颜料`,
        html: buildHtml(rec)
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: 'failed', error: data.message || `Resend HTTP ${res.status}` };
    }
    return { status: 'sent', id: data.id };
  } catch (e) {
    return { status: 'failed', error: String((e && e.message) || e) };
  }
}

/* 可选：绑了 KV 就存一份，没绑就纯靠邮件，两条路互不阻塞 */
async function saveKV(env, rec) {
  const kv = env.INQUIRY_KV;
  if (!kv) return { status: 'skipped', reason: '未绑定 INQUIRY_KV，纯邮件模式' };
  try {
    await kv.put(rec.id, JSON.stringify(rec));
    return { status: 'saved', key: rec.id };
  } catch (e) {
    return { status: 'failed', error: String((e && e.message) || e) };
  }
}

/* ============ 主流程 ============ */

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin');
  const cors = corsFor(origin);

  /* 204 响应不允许带 body，必须传 null；传空字符串会抛 TypeError，
     导致预检失败、跨域 POST 被浏览器拦截 */
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405, cors);
  }

  /* 来源校验：带 Origin 但不在白名单 → 拒绝 */
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ ok: false, error: '来源不被允许' }, 403, cors);
  }

  /* 频率限制 */
  const ip = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')
    || 'unknown';
  const rl = rateCheck(ip);
  if (!rl.allowed) {
    return json(
      { ok: false, error: '提交过于频繁，请稍后再试或直接电话联系' },
      429,
      { ...cors, 'Retry-After': String(rl.retryAfter) }
    );
  }

  let data = {};
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: '请求体不是合法 JSON' }, 400, cors);
  }

  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  const products = String(data.products || '').trim();
  const description = String(data.desc || '').trim();

  if (!name || !phone) {
    return json({ ok: false, error: '姓名和电话必填' }, 400, cors);
  }
  if (name.length > 60 || phone.length > 40 || description.length > 2000 || products.length > 200) {
    return json({ ok: false, error: '字段超长' }, 400, cors);
  }

  /* 联系方式格式校验。
     注意：表单字段是「电话/微信」，必须同时接纳手机号、固话和微信号。
     早期版本只校验数字位数，导致 wxid_xxx 这类合法微信号被拒，直接影响询盘，已修正。 */
  const contact = phone.replace(/[\s-]/g, '');
  const contactOk =
    /^1[3-9]\d{9}$/.test(contact) ||                        // 手机号 13800138000
    /^0\d{9,11}$/.test(contact) ||                          // 固话 02156690218
    /^[a-zA-Z][a-zA-Z0-9_]{5,19}$/.test(contact) ||         // 微信号 wxid_fengyan88
    (/^\d{6,20}$/.test(contact));                           // 兜底：其它纯数字号码
  if (!contactOk) {
    return json({ ok: false, error: '请填写有效的手机号、固话或微信号' }, 400, cors);
  }

  const now = Date.now();
  const rec = {
    id: makeKey(now),
    name,
    phone,
    products,
    description,
    source: 'fengyan-website',
    ip,
    created_at: new Date(now).toISOString()
  };

  const [mail, store] = await Promise.all([sendMail(env, rec), saveKV(env, rec)]);

  if (mail.status !== 'sent' && store.status !== 'saved') {
    return json({
      ok: false,
      error: '提交失败，请稍后重试或直接电话联系',
      mail,
      store
    }, 500, cors);
  }

  return json({ ok: true, id: rec.id, mail, store, remaining: rl.remaining }, 200, cors);
}
