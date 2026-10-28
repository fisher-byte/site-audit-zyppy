# 示例报告

这是用公开示例站跑出来的一份结果，用来看报告长什么样。
健康分只按这次自动检查扣分，不是搜索排名预测。

生成日期：2026-10-28

## 总览

| 站点 | 健康分 | 首页速度 | 问题（严重/高/中/低） | 站点地图 | RSS | llms.txt |
|---|---:|---:|---|---|---|---|
| example.com | 0 | 94 ms | 0/4/8/5 | 404 | 没有 | 404 |
| www.iana.org | 34 | 127 ms | 0/2/6/3 | 404 | 没有 | 404 |

## 各站看到了什么

### example.com

- 健康分：0
- 标题：Example Domain
- 描述：（没有描述）
- H1：（没有 H1）
- 规范链接：（没有）
- 首页是否允许收录：index-ok
- 首页可见文字：145 字
- 结构化数据：（没有）
- 抽到的文章：0 篇
- 关于/联系页：（没找到）
- 首页有没有联系入口：没有
- 不存在的地址返回：404
- AI 爬虫被明确拦住：0 / 0

**问题**

- 高 · 首页缺 H1（Keywords in H1 +1.67）
- 高 · 首页可见文本仅 145 字符 — 可能依赖 JS 渲染（Content Requires Client-Side JavaScript -1.04）
- 高 · Sitemap 不可用: https://example.com/sitemap.xml (404)（URL Included in XML Sitemap +0.80）
- 高 · 首页与 Sitemap 均未发现文章页链接（Content）
- 中 · 缺少 HSTS 响应头（HTTPS +1.28）
- 中 · 首页缺 meta description（Meta Description +0.22）
- 中 · 首页缺 canonical（Correct Canonicalization +1.56）
- 中 · 首页无 mailto 联系方式（Visible Contact Information +1.09）
- 中 · 首页无 JSON-LD 结构化数据（Structured Data +0.96）
- 中 · robots.txt 不可用 (404)
- 中 · 未发现可用 RSS feed
- 中 · 未发现 About/联系页面
- 低 · 缺少 X-Content-Type-Options
- 低 · 缺少 X-Frame-Options / frame-ancestors
- 低 · 首页未发现搜索表单
- 低 · 缺 og:image
- 低 · 无 llms.txt（llms.txt File +0.05）

### www.iana.org

- 健康分：34
- 标题：Internet Assigned Numbers Authority
- 描述：（没有描述）
- H1：Internet Assigned Numbers Authority
- 规范链接：https://iana.org/
- 首页是否允许收录：index-ok
- 首页可见文字：1110 字
- 结构化数据：（没有）
- 抽到的文章：0 篇
- 关于/联系页：/about
- 首页有没有联系入口：没有
- 不存在的地址返回：404
- AI 爬虫被明确拦住：0 / 17

**问题**

- 高 · Sitemap 不可用: https://www.iana.org/sitemap.xml (404)（URL Included in XML Sitemap +0.80）
- 高 · 首页与 Sitemap 均未发现文章页链接（Content）
- 中 · 首页缺 meta description（Meta Description +0.22）
- 中 · 首页无 mailto 联系方式（Visible Contact Information +1.09）
- 中 · 首页无 JSON-LD 结构化数据（Structured Data +0.96）
- 中 · robots.txt 未声明 Sitemap
- 中 · 未发现可用 RSS feed
- 中 · /archive?page=2 未 noindex — 分页页可能产生重复收录（Duplicate Content -1.19）
- 低 · 首页未发现搜索表单
- 低 · 缺 og:image
- 低 · 无 llms.txt（llms.txt File +0.05）

## 这份报告没有覆盖的事

外链质量、品牌被搜索的次数、用户是否满意，都要另外接搜索后台，不能只看网页。
