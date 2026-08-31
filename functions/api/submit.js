/**
 * 峰妍新材料官网 - 询盘提交（Cloudflare Pages Functions）
 *
 * 为什么不用 nodemailer：Cloudflare Pages Functions 跑在 Workers 运行时（V8 isolate），
 * 没有 Node 的 net / tls / dns 模块，nodemailer 无法建立 SMTP 连接，即使开 nodejs_compat 也不行。
 * 因此改用 Resend 的 HTTP API —— 纯 fetch 调用，Workers 原生支持，无第三方依赖。
 *
 * 环境变量（Cloudflare Pages → 项目 → 设置 → 环境变量，生产/预览分别配置）：
 *   RESEND_API_KEY   必填。Resend 后台创建，形如 re_xxxxxxxx
 *   MAIL_FROM        必填。发件地址，其域名必须已在 Resend 完成 DNS 验证，如 notify@fengyan.com
 *   NOTIFY_EMAIL     必填。收件邮箱，多个用英文逗号分隔
 *   ADMIN_TOKEN      可选。配置后启用 /api/inquiries 导出接口
 *
 * 可选存档：在 Pages 设置里绑定 KV 命名空间，变量名填 INQUIRY_KV，代码会自动写一份备份；
 * 不绑定则纯邮件运行，不依赖任何数据库。
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
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

  /* 允许 MAIL_FROM 直接写成 "峰妍新材料 <notify@fengyan.com>" 的完整格式 */
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

export async function onRequest(context) {
  const { request, env } = context;

  /* 204 响应不允许带 body，必须传 null；传空字符串会抛 TypeError，导致预检失败、跨域 POST 被浏览器拦截 */
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405);
  }

  let data = {};
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: '请求体不是合法 JSON' }, 400);
  }

  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  const products = String(data.products || '').trim();
  const description = String(data.desc || '').trim();

  if (!name || !phone) {
    return json({ ok: false, error: '姓名和电话必填' }, 400);
  }
  if (name.length > 60 || phone.length > 40 || description.length > 2000) {
    return json({ ok: false, error: '字段超长' }, 400);
  }

  const now = Date.now();
  const rec = {
    id: makeKey(now),
    name,
    phone,
    products,
    description,
    source: 'fengyan-website',
    created_at: new Date(now).toISOString()
  };

  const [mail, store] = await Promise.all([sendMail(env, rec), saveKV(env, rec)]);

  if (mail.status !== 'sent' && store.status !== 'saved') {
    return json({
      ok: false,
      error: '提交失败，请稍后重试或直接电话联系',
      mail,
      store
    }, 500);
  }

  return json({ ok: true, id: rec.id, mail, store });
}
