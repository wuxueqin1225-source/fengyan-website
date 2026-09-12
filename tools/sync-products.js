/**
 * 产品数据同步工具
 *
 * 背景：index.html 里内联的 PRODUCTS 才是页面真正用的数据源
 *      （单页 + 双击可打开的形态，不适合用 fetch 读 JSON）。
 *      products.json 是同一份数据的镜像，供外部系统读取。
 *      两边一旦不同步，就会出现「改了 json 页面没反应」这种极难排查的问题。
 *
 * 用法：改完 index.html 里的 PRODUCTS 之后执行一次
 *      node tools/sync-products.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const jsonPath = path.join(root, 'products.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/const PRODUCTS = (\[[\s\S]*?\n\]);/);
if (!m) {
  console.error('✗ 没能在 index.html 中找到 PRODUCTS 数组');
  process.exit(1);
}

// 源是自家文件，可信
const PRODUCTS = eval(m[1]);

// 校验基本完整性
const bad = PRODUCTS.filter(
  (p) => !p.code || !p.index || !/^#[0-9A-Fa-f]{6}$/.test(p.color || '') || !p.cat
);
if (bad.length) {
  console.error('✗ 以下产品缺关键字段:', bad.map((p) => p.code || '(无 code)').join(', '));
  process.exit(1);
}

const codes = new Set(PRODUCTS.map((p) => p.code));
if (codes.size !== PRODUCTS.length) {
  console.error('✗ 存在重复的 code');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
data.products = PRODUCTS;
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

const stats = PRODUCTS.reduce((acc, p) => ((acc[p.cat] = (acc[p.cat] || 0) + 1), acc), {});
console.log('✓ products.json 已同步');
console.log('  产品总数:', PRODUCTS.length);
Object.entries(stats).forEach(([k, v]) => console.log('   ', k + ':', v));
