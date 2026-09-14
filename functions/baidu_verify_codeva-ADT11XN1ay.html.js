/**
 * 百度站长平台 · 站点所有权验证（文件验证方式）
 *
 * 为什么用 Pages Function 而不是放一个静态 .html 文件：
 *   Cloudflare Pages 会对所有 .html 请求做「去扩展名」跳转 —— 实测
 *   /baidu_verify_codeva-ADT11XN1ay.html 返回 308 永久重定向到无扩展名地址
 *   （/404.html → /404、/index.html → / 同样如此，是全站行为，配置关不掉）。
 *   百度验证机器人抓到 308 能否正确跟随并不受我们控制，而 308 会被长期缓存，
 *   一旦它不跟随，站点验证就会一直卡着，且很难排查。
 *   改由 Function 直接应答后，响应就是 200 + 验证串，链路里没有任何跳转。
 *
 * 路由：functions/ 下的文件名去掉 .js 就是路径，所以这个文件对应
 *       /baidu_verify_codeva-ADT11XN1ay.html
 *       同时需要在 _routes.json 的 include 里声明，否则请求会先被静态资源层接走。
 *
 * ⚠️ 验证通过后不要删这个文件 —— 百度会定期复验，删掉会导致已验证的站点掉验证。
 *    同名的静态文件 baidu_verify_codeva-ADT11XN1ay.html 保留着做兜底（万一 Function 未生效）。
 */
const VERIFY_CODE = '2aa8d9af8e4e20fa6ecf8c3af561cf13';

export async function onRequest() {
  return new Response(VERIFY_CODE, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
