/**
 * 峰妍新材料官网 - 询盘提交（EdgeOne Makers Cloud Functions）
 *
 * 存储：Makers KV，需在控制台「KV 存储」绑定命名空间，变量名必须为 inquiry_kv
 * 通知：nodemailer + SMTP，环境变量未配置时自动跳过，不影响存档
 *
 * 环境变量（控制台 → 项目设置 → 环境变量，全部可空）：
 *   SMTP_HOST     发件服务器，如 smtp.qq.com
 *   SMTP_PORT     端口，默认 465（SSL）
 *   SMTP_USER     发件邮箱账号
 *   SMTP_PASS     发件邮箱授权码
 *   NOTIFY_EMAIL  收件邮箱（通知发到哪）
 */
import nodemailer from 'nodemailer';

/* KV 由运行时注入为全局变量，未绑定时优雅降级为不存档 */
const KV = typeof inquiry_kv !== 'undefined' ? inquiry_kv : null;

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

/* 环境变量：优先取 Makers 注入的 context.env，回退到 process.env */
function env(context, key) {
  const bag = (context && context.env) || {};
  const val = bag[key];
  return val !== undefined && val !== '' ? val : (process.env[key] || '');
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const pad = (n) => String(n).padStart(2, '0');

/* 北京时间拆分，用于生成可读的 KV key 与展示时间 */
function bj(ts) {
  const d = new Date(ts + 8 * 3600 * 1000);
  return {
    date: `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
    clock: `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  };
}

/**
 * 生成 KV key。KV 规范限制：仅允许数字、字母、下划线，长度 <= 512B。
 * 形如 inq_20260830_230615_a1b2c3，可用 list({ prefix: 'inq_20260830' }) 查当天全部。
 */
function makeKey(ts) {
  const t = bj(ts);
  const rand = Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, '0');
  return `inq_${t.date}_${t.clock}_${rand}`;
}

async function saveToKV(record) {
  if (!KV) return { status: 'skipped', reason: '未绑定 KV 命名空间 inquiry_kv' };
  try {
    const key = makeKey(Date.parse(record.created_at));
    await KV.put(key, JSON.stringify(record));
    return { status: 'saved', key };
  } catch (e) {
    return { status: 'failed', error: String((e && e.message) || e) };
  }
}

async function sendNotifyMail(cfg, record) {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass, NOTIFY_EMAIL: to } = cfg;
  if (!host || !user || !pass || !to) {
    return { status: 'skipped', reason: 'SMTP 未配置或收件邮箱为空' };
  }
  try {
    const port = Number(cfg.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });

    const t = bj(Date.parse(record.created_at));
    await transporter.sendMail({
      from: `"峰妍新材料官网" <${user}>`,
      to,
      subject: `【新询盘】${record.name} 咨询颜料`,
      html: `
        <div style="font-family:'Microsoft YaHei',sans-serif;max-width:560px;margin:0 auto;border:1px solid #eee;border-radius:6px;overflow:hidden">
          <div style="background:#0A0A0B;padding:18px 24px;color:#fff">
            <span style="font-size:17px;font-weight:bold;font-family:Georgia,serif">Fengyan®</span>
            <span style="color:#FF9999;font-size:13px;margin-left:10px">峰妍新材料 · 新询盘通知</span>
          </div>
          <div style="padding:24px">
            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1E1E1F">
              <tr><td style="padding:8px 12px;background:#F5F5F4;width:96px;font-weight:600">姓名/公司</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(record.name)}</td></tr>
              <tr><td style="padding:8px 12px;background:#F5F5F4;font-weight:600">电话/微信</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(record.phone)}</td></tr>
              <tr><td style="padding:8px 12px;background:#F5F5F4;font-weight:600">意向产品</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(record.products) || '—'}</td></tr>
              <tr><td style="padding:8px 12px;background:#F5F5F4;font-weight:600">需求描述</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${esc(record.description) || '—'}</td></tr>
              <tr><td style="padding:8px 12px;background:#F5F5F4;font-weight:600">提交时间</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${record.created_at.replace('T', ' ').slice(0, 19)} (北京时间 ${t.time})</td></tr>
            </table>
            <p style="font-size:12px;color:#9E9E9E;margin-top:16px">收到后请尽快联系客户。存档编号 ${esc(record.id)}。</p>
          </div>
        </div>`
    });
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', error: String((e && e.message) || e) };
  }
}

export async function onRequest(context) {
  const req = context.request;

  /* 204 响应不允许带 body，必须传 null */
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405);
  }

  let data = {};
  try {
    data = await req.json();
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

  const now = Date.now();
  const record = {
    id: makeKey(now),
    name,
    phone,
    products,
    description,
    source: 'fengyan-website',
    created_at: new Date(now).toISOString()
  };

  /* 存档与邮件互不影响，任一失败都要让另一条路走完 */
  const [store, mail] = await Promise.all([
    saveToKV(record),
    sendNotifyMail({
      SMTP_HOST: env(context, 'SMTP_HOST'),
      SMTP_PORT: env(context, 'SMTP_PORT'),
      SMTP_USER: env(context, 'SMTP_USER'),
      SMTP_PASS: env(context, 'SMTP_PASS'),
      NOTIFY_EMAIL: env(context, 'NOTIFY_EMAIL')
    }, record)
  ]);

  const stored = store.status === 'saved';
  const mailed = mail.status === 'sent';

  /* 两条路都断掉才判定为失败，让前端走 localStorage 兜底 */
  if (!stored && !mailed) {
    return json({
      ok: false,
      error: '提交失败，请稍后重试或直接电话联系',
      kv: store,
      mail
    }, 500);
  }

  return json({ ok: true, id: record.id, kv: store, mail });
}
