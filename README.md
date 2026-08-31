# 峰妍新材料科技（上海）有限公司 — 官网

Fengyan® 工业颜料供应链官网 · 单文件静态站 · 托管于 EdgeOne Makers

## 项目结构

```
fengyan-website/
├── index.html                 # 网站主文件（单文件 SPA，含全部 CSS/JS/产品数据）
├── products.json              # 产品数据（43 个产品完整参数，独立数据文件）
├── cloud-functions/           # EdgeOne Makers 云函数
│   └── api/
│       ├── submit/            # POST /api/submit   询盘提交：KV 存档 + 邮件通知
│       │   ├── index.js
│       │   └── package.json   # 依赖 nodemailer
│       └── inquiries/         # GET  /api/inquiries 询盘导出（需 token）
│           └── index.js
├── edgeone.json               # Makers 配置：声明 cloud-functions 目录
├── assets/                    # 素材（fonts/ 被引用；色卡与名片为原始备份）
│   ├── about-office.jpg       # 被引用
│   ├── team-workspace.jpg     # 被引用
│   └── fonts/                 # Playfair Display，被引用
├── _deprecated-cloudbase-cloudfunctions/   # CloudBase 旧后端，已停用，待删除
└── README.md
```

> `assets/` 里的 `hero-pigment.jpg` 与四张色卡/名片**未被引用**，属于原始素材备份，部署前可移出以减小上传体积。

## 运行方式

- **本地打开**：直接双击 `index.html`（无需服务器，hash 路由兼容 `file://`，但询盘提交会失败，因为需要 `/api/submit`）
- **本地服务器**：`python -m http.server 8899` 后访问 `http://localhost:8899`
- **完整本地调试（含云函数）**：`edgeone makers dev`，会同时起前端和函数，端口 8088

## 页面路由（hash 路由）

| 路由 | 页面 |
|---|---|
| `#/` | 首页（Hero / 产品分类 / 色卡速览 / 客户案例 / 团队 / CTA） |
| `#/products` | 产品中心（43 个色号，全部/有机/无机筛选） |
| `#/product/{code}` | 产品详情页（参数表 + 相关色号），如 `#/product/red-2540` |
| `#/about` | 关于我们 |
| `#/contact` | 联系我们（询盘表单） |

## 产品数据说明

- 43 个产品：有机颜料 35（黄 13 / 橙 4 / 红 8 / 粉 2 / 紫 3 / 蓝 4 / 绿 1）+ 无机颜料 8（黄 6 / 红 2）
- 参数字段：`code`（产品码）、`index`（颜料索引）、`series`（色系）、`name`（中文名）、`color`（色值）、`cat`（organic/inorganic）、`oa`（吸油量）、`heat`（耐热℃）、`lf`（耐候）、`mg`（耐迁移）、`enc`（无机表面处理）
- **修改产品数据**：改 `index.html` 里 `const PRODUCTS = [...]` 数组，或维护 `products.json`（需手动同步）

## 询盘表单后端

联系页表单提交后，云函数 `cloud-functions/api/submit` 做两件事：**写入 Makers KV 存档** + **发送邮件通知**。两条路互不影响，任一失败另一条仍会走完；只有两条都断掉才返回失败，此时前端会暂存 localStorage 兜底。

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

## 设计规范

- 品牌色：信号红 `#E60012` / 深底浅红 `#FF9999` / 深底亮红 `#FF5757`
- 底色：近黑 `#0A0A0B` + 浅灰 `#F5F5F4`
- 字体：Noto Sans SC（中文）+ Playfair Display（英文衬线点缀）
- 圆角：按钮 3px / 卡片 6px（Fleet 风格工业硬朗）

## 待办

- [x] 询盘表单接入后端（已改造为 KV 存档 + 邮件通知）
- [ ] 注册域名并提交 ICP 备案
- [ ] 配置邮件通知 SMTP（填 5 个环境变量即生效）
- [ ] 绑定 KV 命名空间 `inquiry_kv`
- [ ] 配置 `ADMIN_TOKEN` 并验证导出接口
- [ ] 数据条数字替换为真实业务数据
- [ ] 团队/关于页配图替换为真实照片
- [ ] 替换 ICP 备案号占位
- [ ] 验证新链路后删除 `_deprecated-cloudbase-cloudfunctions/` 并释放 CloudBase 环境
