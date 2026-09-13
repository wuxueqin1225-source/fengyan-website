# 峰妍新材料科技（上海）有限公司 — 官网

Fengyan® 工业颜料供应链官网 · 单文件静态站 · 托管于 EdgeOne Makers

## 项目结构

```
fengyan-website/
├── index.html                 # 网站主文件（单文件 SPA，含全部 CSS/JS/产品数据）
├── products.json              # 产品数据（75 个产品完整参数，独立数据文件）
├── functions/api/submit.js    # Cloudflare Pages Function —— 当前唯一的表单链路
├── _routes.json               # Cloudflare Pages 路由配置
├── assets/                    # 素材（下列文件均被页面引用，除非注明）
│   ├── about-office.webp      # 关于页配图（WebP）
│   ├── team-workspace.webp    # 团队页配图（WebP）
│   ├── fonts/                 # Playfair Display 四档子集（400i / 500i / 600 / 700）
│   ├── 色卡-橙红粉紫.jpg       # 原始素材备份，未被页面引用
│   ├── 色卡-蓝绿无机.jpg       # 同上
│   ├── 色卡-黄橙红.jpg         # 同上
│   └── 名片-峰妍新材料.jpg     # 同上
├── tools/sync-products.js     # 校验字段与 code 唯一性，再把数据同步到 products.json
├── sitemap.xml / robots.txt / favicon.* / apple-touch-icon.png / og-image.png
├── _originals/                # 本地留档：配图原图、已下线素材（gitignore，不部署）
├── _deprecated-edgeone-makers/          # EdgeOne Makers 旧后端 + edgeone.json（gitignore，不部署）
├── _deprecated-cloudbase-cloudfunctions/ # CloudBase 旧后端（gitignore，不部署）
└── README.md
```

> `assets/` 里的四张色卡 / 名片**未被引用**，属于原始素材备份，部署前可移出以减小上传体积。
> `_originals/` 存放的是被 WebP 替换掉的配图原图（`about-office.png` —— 它虽然叫 .jpg，
> 实际是 PNG；`team-workspace.jpg`）与已下线的 `hero-pigment.jpg`、`playfair-400.woff2`。
> 这三个目录都写在 `.gitignore` 里，不进仓库、也不参与任何平台的部署；需要时从 git 历史取回。

## 运行方式

- **本地打开**：直接双击 `index.html`（无需服务器，hash 路由兼容 `file://`，但询盘提交会失败，因为需要 `/api/submit`）
- **本地服务器**：`python -m http.server 8899` 后访问 `http://localhost:8899`
- **完整本地调试（含云函数）**：`edgeone makers dev`，会同时起前端和函数，端口 8088

## 页面路由（hash 路由）

| 路由 | 页面 |
|---|---|
| `#/` | 首页（Hero / 产品分类 / 色卡速览 / 客户案例 / 团队 / CTA） |
| `#/products` | 产品中心（全部 75 个牌号，按色系分组） |
| `#/products/organic` | 产品中心 · 只显示有机颜料（35）。`inorganic`（8）/ `ironoxide`（32）同理 |
| `#/product/{code}` | 产品详情页（参数表 + 相关色号）。**code 里有空格，URL 里要编码成 `%20`**，如 `#/product/Red%202540` |
| `#/about` | 关于我们 |
| `#/contact` | 联系我们（询盘表单） |

> 首页三张类目卡分别指向 `#/products/organic`、`#/products/inorganic`、`#/products/ironoxide`；
> 详情页面包屑里的类目也可点，同样落到对应筛选。
> 页签点击会改写 URL，所以后退键能在「全部 / 各类目」之间正常来回。

## 产品数据说明

- **75 个产品**，分三个类目（`cat` 字段决定类目标签）：

  | 类目 | cat | 数量 | 说明 |
  |---|---|---|---|
  | 有机颜料 | `organic` | 35 | 黄 13 / 橙 4 / 红 8 / 粉 2 / 紫 3 / 蓝 4 / 绿 1 |
  | 无机颜料 | `inorganic` | 8 | PG.34 黄 6 / PG.104 红 2，包膜 · 高包膜 · 经济型 |
  | **氧化铁系列** | `ironoxide` | **32** | 红 19 / 黄 5 / 黑 4 / 棕 1 / 绿 1 / 橙 1 / 蓝 1 |

- 通用参数：`code`（产品码）、`index`（颜料索引）、`series`（色系）、`name`（中文名）、`color`（原色值）、`cat`（类目）、`oa`（吸油量 g/100g）、`heat`（耐热℃）、`lf`（耐候）、`mg`（耐迁移）、`enc`（标准型 / 微粉化 / 包膜等）
- 氧化铁额外字段：`tint`（冲淡色值）、`cas`（CAS 号）、`chem`（化学名称）、`pack`（销售包装）、`note`（关键使用提示，如「氧化铁黄超过 180℃ 会脱水转红」）

### 修改产品数据（重要）

**唯一数据源是 `index.html` 里的 `const PRODUCTS = [...]` 数组。** 页面把它当 JS 直接执行，不走网络请求。
`products.json` 是给外部系统读的镜像，**页面运行时并不加载它** —— 只改 json 页面不会有任何变化。

改完 index.html 后执行同步：

```bash
node tools/sync-products.js
```

脚本会校验字段完整性与 code 唯一性，再把数据写回 `products.json`。

### 氧化铁系列的数据来路

2026-09-12 从公开的产品型录采集整理，做了三项处理：

1. **品牌中立化** —— 原文案含第三方厂商品牌名，已全部重写为按颜料物性与应用描述的通用文案
2. **分子式纠正** —— 源处把氧化铁红误标为 `Fe₂O₃·αH₂O`（那是氧化铁黄的式子），已按 GB/T 1863 纠正为：红 `Fe₂O₃`、黄 `α-FeOOH`、黑 `Fe₃O₄`
3. **技术指标** —— 源处未提供吸油量 / 耐热 / 耐候数据，按 GB/T 1863 与行业公认值填写，**页面已标注「典型值，以随货 TDS 为准」**。拿到厂家真实 TDS 后务必替换

## 询盘表单后端

联系页表单提交后，Pages Function `functions/api/submit.js` 做两件事：**写一份到 KV 存档（需绑定）** + **调 Resend HTTP API 发邮件通知**。两条路互不影响，任一失败另一条仍会走完；只有两条都断掉才返回失败。

> ⚠️ 2026-09-14：EdgeOne 时代的旧后端（`cloud-functions/api/submit`、`cloud-functions/api/inquiries`）
> 与它对应的 `edgeone.json` 已整体移入 `_deprecated-edgeone-makers/`。
> 原因见「修复记录 → P1-11」：那条链路没有 CORS 白名单、没有限流、没有长度上限，
> 却仍被 `edgeone.json` 指向，任何一次按它部署都会把无防护版本发上线。
> **仓库里现在只剩 `functions/api/submit.js` 一条可部署的表单链路。**
> 顺带一提：`/api/inquiries` 导出接口是 EdgeOne 独有的，迁移到 Cloudflare 后就已不可用，
> 归档它不损失任何现有能力。

### 环境变量

在 Makers 控制台 → 项目设置 → 环境变量中配置。**邮件相关全部可空**——未配置时自动跳过，不影响存档。

| 变量 | 说明 | 示例 |
|---|---|---|
| `SMTP_HOST` | 发件服务器 | `smtp.qq.com` |
| `SMTP_PORT` | 端口（默认 465 SSL） | `465` |
| `SMTP_USER` | 发件邮箱账号 | `fengyan@qq.com` |
| `SMTP_PASS` | 发件邮箱授权码 | 邮箱设置里开启 SMTP 后生成 |
| `NOTIFY_EMAIL` | 收件邮箱（通知发到哪） | `sales@fengyan.com` |
| `ADMIN_TOKEN` | 询盘导出接口的口令 | 自定义一串长随机字符串 |

> 推荐用 QQ 邮箱：设置 → 账户 → 开启 SMTP 服务 → 生成授权码填到 `SMTP_PASS`。

### KV 绑定（必做）

存档依赖 Makers KV，不绑定则询盘只发邮件、不落库。

1. 控制台 → KV 存储 → 创建命名空间（如 `fengyan-inquiry`）
2. 项目详情 → KV 存储 → 绑定命名空间，**变量名必须填 `inquiry_kv`**（代码里按这个全局变量名访问）
3. 重新部署一次项目，绑定才生效

KV key 形如 `inq_20260830_230615_a1b2c3`，仅含数字字母下划线（KV 规范限制），字典序即时间顺序。

### 导出询盘

```
GET /api/inquiries?token=<ADMIN_TOKEN>                  # 最近 50 条，JSON
GET /api/inquiries?token=<ADMIN_TOKEN>&date=20260830    # 指定某天
GET /api/inquiries?token=<ADMIN_TOKEN>&date=202608      # 指定某月
GET /api/inquiries?token=<ADMIN_TOKEN>&format=csv       # 下载 CSV
```

未配置 `ADMIN_TOKEN` 时接口直接返回 503（fail closed）。**这个 token 会暴露客户手机号，切勿写进前端或提交到 Git。**

## 部署到 Cloudflare Pages（当前方案）

静态站点由 GitHub 驱动，表单走 Pages Functions + Resend HTTP API。

### 为什么邮件改用 Resend

Cloudflare Pages Functions 运行在 Workers（V8 isolate），**没有 Node 的 `net` / `tls` 模块**，`nodemailer` 建立不了 SMTP 连接，开 `nodejs_compat` 也补不上。所以改成纯 `fetch` 调 Resend 的 HTTP API，Workers 原生支持、零依赖。

### 一、Resend 准备

1. 注册 <https://resend.com>，免费额度 3000 封/月，询盘量远用不完
2. Domains → Add Domain，填入你的域名，按提示到腾讯云 DNS 加 SPF / DKIM / DMARC 三条记录
3. 验证通过后 API Keys → Create，权限选 **Sending access**，复制 `re_xxx`（只显示一次）

> 未验证域名时只能用 `onboarding@resend.dev` 发信，且仅能发到注册邮箱——够联调用，正式上线请换成自己的域名。

### 二、推到 GitHub

```bash
git add -A
git commit -m "迁移到 Cloudflare Pages"
git remote add origin git@github.com:<用户名>/<仓库>.git
git push -u origin main
```

### 三、Cloudflare Pages 建项目

Workers & Pages → Create → Pages → Connect to Git，选中仓库后：

| 配置项 | 值 |
|---|---|
| Framework preset | `None` |
| Build command | 留空（纯静态，无需构建） |
| Build output directory | `/` |

### 四、环境变量

Settings → Environment variables（Production 和 Preview 分别加）：

| 变量 | 示例 | 说明 |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxx` | 必填 |
| `MAIL_FROM` | `notify@你的域名.com` | 必填，域名须已在 Resend 验证 |
| `NOTIFY_EMAIL` | `sales@你的域名.com` | 必填，多个用英文逗号分隔 |

改完环境变量必须**重新部署一次**才生效。

### 五、绑定自定义域名（CNAME 方式）

保留腾讯云 DNS 不动，只加一条 CNAME，企业邮箱 MX 与其他子域不受影响：

1. Cloudflare Pages → 项目 → Custom domains → Set up a custom domain
2. 填入域名（建议用 `www` 等子域，根域名留给邮箱等业务）
3. 腾讯云域名控制台 → 解析，添加记录：

| 主机记录 | 类型 | 记录值 |
|---|---|---|
| `www` | CNAME | `<项目名>.pages.dev` |

SSL 证书由 Cloudflare 自动签发，通常几分钟生效。**不要开启橙色云代理**，CNAME 接入下可能冲突。

### 六、验证清单

```bash
curl -X OPTIONS -i https://你的域名/api/submit    # 应返回 204

curl -X POST https://你的域名/api/submit \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试","phone":"13800000000","products":"柠檬黄","desc":"联调"}'
# 收件邮箱应收到邮件
```

### 关于存档

默认**不依赖任何数据库**，询盘只走邮件。如需备份：Pages → Settings → Functions → KV namespace bindings，变量名填 `INQUIRY_KV`，代码会自动多写一份。

---

## 部署到 EdgeOne Makers（历史方案）

> 已迁移至 Cloudflare Pages，以下内容仅作回退参考。
> **2026-09-14 起，本节涉及的 `cloud-functions/` 与 `edgeone.json` 已移入 `_deprecated-edgeone-makers/`**
> （gitignore，不进仓库、不参与部署）。要彻底回到 EdgeOne，需先把这两个路径移回项目根目录。

### 前置条件：域名与备案（硬门槛）

面向国内访问的官网**必须绑定已备案的自定义域名**，没有替代方案：

- 加速区域选「中国大陆」或「全球（含中国大陆）」时，平台自动分配的默认域名**只能用系统生成的 3 小时预览链接**访问，超时返回 401，不能当正式官网用
- 加速区域选「全球（不含中国大陆）」虽免备案，但大陆网络访问同样返回 401

所以顺序是：**注册域名 → 提交 ICP 备案（通常 10–20 个工作日）→ 备案通过后再绑域名正式上线**。备案期间可先用预览链接做内部调试。

### 部署步骤

```bash
npm install -g edgeone
edgeone login                      # 国内站；注意区分国际站账号
edgeone makers create fengyan-website   # 或从控制台导入 Git 仓库
edgeone makers link                # 绑定线上项目
edgeone makers dev                 # 本地调试
edgeone makers deploy              # 部署
```

控制台里还需要设置：

- **加速区域**：全球（含中国大陆）或中国大陆
- **函数部署地域**：`ap-shanghai`（离公司近，SMTP 出站也更稳）
- **自定义域名**：备案通过后绑定，SSL 证书由平台自动签发，无需自己申请

### 关于 CloudBase

旧后端依赖 CloudBase 云函数 + PostgreSQL，代码保留在 `_deprecated-cloudbase-cloudfunctions/`。新链路验证无误后，可以删除该目录并释放 CloudBase 环境 `hjj-d5g2vy73114fa5a59`（释放前确认无其他应用挂在上面）。

## 搜索引擎与分享（2026-09-13 补充）

站点的对外呈现由 `<head>` 里这几组标签决定，改文案只动 `index.html` 顶部即可：

| 标签 | 作用 | 出现在哪 |
|---|---|---|
| `<title>` | 蓝字标题 | 搜索结果、浏览器标签页 |
| `meta description` | 标题下面那两行灰字 | 搜索结果摘要 |
| `og:title` / `og:description` / `og:image` | 分享卡片 | 微信、QQ、钉钉、LinkedIn 转发链接时 |
| `twitter:*` | 同上，给 X/部分预览工具用 | 分享卡片 |
| `<link rel="canonical">` | 声明正式地址 | 防 `www` 与裸域被当成两个站 |

分享图 `og-image.png`（1200×630）由脚本生成，右侧色卡直接取 `products.json` 里的真实产品色：

```bash
python .workbuddy/tmp/make_og.py     # 产品配色变了可以重跑
```

### ⚠️ 现状：站点尚未被搜索引擎收录

截至 2026-09-13 实测，`site:fengyanpigment.com` 零结果，搜公司名只出第三方企业名录。
技术层面没有被拦（Baiduspider / Googlebot / bingbot 抓取均 200），**问题是没有任何外链、且从未提交过站点地图**。

待办（需要账号权限，只能由站点所有者操作）：

- [ ] 百度站长平台 / Google Search Console / Bing Webmaster 各提交一次 `sitemap.xml`
- [ ] 企查查、启信宝、爱采购等名录**认领企业并填写官网字段**（当前显示为空）
- [ ] 建设外链：B2B 黄页、行业名录、供应商平台

结构性限制（已知，暂不处理）：

- 全站 hash 路由，**只有首页 1 个可索引 URL**；产品详情不是独立页面，搜索引擎无法单独收录某个牌号
- 产品数据在 `<script>` 里，Google 能渲染 JS 尚可，百度基本读不到产品内容
- 未备案 + Cloudflare 境外节点，对百度收录不利

## 设计规范

- 品牌色：信号红 `#E60012` / 深底浅红 `#FF9999` / 深底亮红 `#FF5757`
- 底色：近黑 `#0A0A0B` + 浅灰 `#F5F5F4`
- 字体：**中文走系统无衬线栈**（`PingFang SC` → `Hiragino Sans GB` → `Microsoft YaHei`），
  英文点缀用 `Playfair Display`（仅意大利体出现在眉标与 logo）；
  色号 / 参数 / 索引统一走等宽栈（`ui-monospace` 系列）。
  > 此前这里写的是「Noto Sans SC」，但 CSS 从未加载过该字体，实际一直落到系统中文字体 ——
  > 2026-09-14 已把文档改成与实际一致（不是改代码去迁就文档）。
- 圆角：按钮 3px / 卡片 6px（Fleet 风格工业硬朗）
- 令牌：色值一律走 `:root` 变量，**不在样式里写裸 hex**（`hover` 用 `var(--red-deep)`）

## 修复记录（2026-09-14 · 按 OpenDesign 评审报告执行）

评审报告：`fengyan-website-review.html`（5 项 P0 / 11 项 P1 / 8 项 P2）。
本次把报告里**不需要外部输入**的条目全部落地，三条涉及真实业务内容的按下方方案处理。

### P0

| 条目 | 处理 |
|---|---|
| P0-1 数据条无出处、口径不一致 | 首页与关于页统一加 `.stats-note` 声明；「100% 批次可追溯」改为可核验的「每批随货提供 TDS/MSDS」 |
| P0-2 三条匿名客户证言 | 换成方案型内容块「色差投诉，多半出在这三处」，标题与眉标同步改（未伪造具名署名） |
| P0-3 配图走 CSS 背景、读屏不可达 | `.team-img` / `.about-img` 改为真 `<img>` + `alt`（图片仍为图库素材，待实拍替换） |
| P0-4 `about-office.jpg` 实为 PNG 且 1.58 MB | 转 WebP，1040×754，**1,657,155 → 66,144 字节（4%）**；`team-workspace` 同步转 1120×812（182 KB → 96 KB）；未引用的 `hero-pigment.jpg` 归档 |
| P0-5 服务端错误从不回显 | `handleSubmit` 按状态码分流：400 落到字段级提示（`aria-describedby` + `aria-invalid`）、429 提示稍后重试、403 提示来源、仅网络异常走致电兜底。已用 5 组 mock 响应逐个验证 |

### P1

| 条目 | 处理 |
|---|---|
| P1-1 首屏两个实心红主按钮 | 导航 CTA 降级为幽灵描边，唯一的实心红留给首屏主按钮 |
| P1-2 「微信咨询」不触发微信 | 按钮改为真复制微信号（含 `execCommand` 兜底，失败则跳联系页）；联系页补「复制微信号」按钮 |
| P1-3 导航 CTA 用 `button onclick` | 改回 `<a href="#/contact">`（抽屉内的 CTA 一并改），删掉全局 `[onclick]:focus-visible` 补丁 |
| P1-4 畸形百分号编码导致白屏 | 新增 `safeDecode()`，解码失败走已有的「未找到牌号」分支。`#/product/%` 已验证不再空白 |
| P1-5 离开首页后画布仍在逐帧绘制 | `window.HeroField` → `HeroField`（顶层 `const` 不挂 `window`，原引用恒为 `undefined`） |
| P1-6 平板 769–830px 横向溢出 | 导航折叠断点 768 → 900px，`.team-wrap` 改 `minmax(0,560px) 1fr` 并在 ≤1100px 降为两列等宽。原版 769px 溢出 34px / 800px 溢出 3px，现全为 0 |
| P1-7 类目卡与数据条缺语义 | `.cat-title` 改 `<h3>`；两处数据条改 `<dl>`（dt/dd 分组） |
| P1-8 全站无结构化数据 | `<head>` 静态输出 `Organization` + `LocalBusiness`；`renderDetail()` 动态注入 `Product` + `BreadcrumbList`，离开详情页时清除 |
| P1-9 同一件事四种数量口径 | 类目卡与产品中心页头改由 `PRODUCTS` 实时计算（保留静态兜底值）；README 的「43 个产品」改为 75 |
| P1-10 询盘 PII 留在访客本机 | 移除 localStorage 兜底（它并不补发，只留下隐私成本）。已验证提交前后 localStorage 均为 0 条 |
| P1-11 旧 EdgeOne 后端仍被部署配置指向 | `cloud-functions/` 与 `edgeone.json` 移入 `_deprecated-edgeone-makers/` 并 gitignore |

### P2

令牌收敛（裸 hex 收进 `:root`，新增 `--font-mono` 等 12 个令牌）；`.iron-note` 去掉「左侧色条 + 单侧圆角」的模板样式，改整块浅底 + 顶部细线；
数据条与参数表补 `tabular-nums`，色号 / 索引统一走等宽栈；`.hero` 高度下限 680 → 560px 并补小高度媒体查询；
页脚链接窄屏触控高度补到约 45px；删除未被命中的 `playfair-400.woff2` 与未引用的 `hero-pigment.jpg`；
路由切换改为瞬时置顶（临时关掉 `scroll-behavior`）；`resize` 加 150ms 防抖。

### 评审未列出、本次一并修掉的

| 问题 | 说明 |
|---|---|
| 窄屏参数表撑破页面 | 详情页 7 列参数表最少需要约 360px，320–390px 屏可用宽度只有 265–335px，**原版就会整页横向滚动**（320px 溢出 74px）。改为表格自身横向可滚（`.params-wrap`），页面不再跟着滚 |
| 抽屉关闭时撑出横向滚动条 | 关闭态面板停在 `translateX(100%)`，右边缘落到视口外，原版在 390px 下即有 4px 溢出。给 `.nav-drawer` 加 `overflow:hidden` |

> 全站 7 条路由 × 10 个视口宽度（320 / 360 / 390 / 414 / 620 / 769 / 830 / 900 / 1024 / 1440）
> 已逐个核对 `scrollWidth - clientWidth`，当前全部为 0。

### 仍未完成（需要外部输入）

- [ ] **配图替换为实拍**：现在用的是图库素材，代码已改成真 `<img>`，换 `src` + `alt` + 宽高即可
- [ ] **数据条换成真实业务数字**：现在文案里标注了「示例口径」
- [ ] **客户证言**：拿到书面授权后，可把方案型内容块换回具名证言（企业简称 + 职衔 + 授权确认）
- [ ] 无机颜料的 Pigment Index 存疑：`Yellow 6102/6108/6116/6118/3104/3114` 写作 `PG.34`、
  `Red 7104/7116` 写作 `PG.104`，按色系推断应为 `PY.34` / `PR.104`，**等客户确认后再改**
  > 注：`PG.7` 是酞菁绿，与上述无机黄/红不是一回事，不要顺手改

## 待办

- [x] 询盘表单接入后端（已改造为 KV 存档 + 邮件通知）
- [x] 注册域名并接入（**暂不进行 ICP 备案**，站点跑 Cloudflare 海外节点）
- [ ] 配置邮件通知（填 3 个环境变量即生效）
- [ ] 绑定 KV 命名空间 `INQUIRY_KV`
- [ ] 数据条数字替换为真实业务数据（当前已标注示例口径）
- [ ] 团队/关于页配图替换为真实照片（代码侧已就绪）
- [x] 页脚 ICP 备案号占位已移除（暂不备案；若日后备案需在页脚补回真实备案号）
- [x] 旧后端下线：EdgeOne 链路已归档，CloudBase 目录仍留在 `_deprecated-cloudbase-cloudfunctions/`
- [ ] 释放 CloudBase 环境 `hjj-d5g2vy73114fa5a59`（确认无其他应用挂载后再释放）
