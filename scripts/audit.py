#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""网站 SEO/GEO 自检。

对照公开页面上能看到的项目做检查，结果写到指定目录，每个站点一份 JSON。
站点名单和额外敏感词都由调用时传入，脚本里不写死任何站点。
"""
import json
import os
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36")
TIMEOUT = 15

AI_CRAWLERS = [
    "GPTBot", "ChatGPT-User", "OAI-SearchBot",
    "ClaudeBot", "Claude-User", "Claude-SearchBot",
    "PerplexityBot", "Perplexity-User",
    "Google-Extended", "GoogleOther",
    "Applebot-Extended", "Bytespider", "CCBot",
    "cohere-ai", "Diffbot", "FacebookBot", "Amazonbot",
]

# 默认只标记本机地址。其余不该出现在公开页上的词，由用户自己的词表提供。
INTERNAL_JARGON = ["localhost", "127.0.0.1"]

ARTICLE_PAT = re.compile(
    r"/(article|articles|news|post|posts|story|stories|p|item|a|original|insights?|guide|guides|blog)/", re.I)


def fetch(url, method="GET"):
    t0 = time.time()
    try:
        r = requests.request(method, url, headers={"User-Agent": UA},
                             timeout=TIMEOUT, allow_redirects=True)
        return {"ok": True, "status": r.status_code, "url": r.url,
                "headers": dict(r.headers), "text": r.text if method == "GET" else "",
                "elapsed_ms": int((time.time() - t0) * 1000),
                "history": [h.status_code for h in r.history]}
    except Exception as e:
        return {"ok": False, "error": str(e), "elapsed_ms": int((time.time() - t0) * 1000)}


def text_len(soup):
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return len(re.sub(r"\s+", "", soup.get_text()))


def analyze_html(html, base_url):
    soup = BeautifulSoup(html, "html.parser")
    out = {}
    out["title"] = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    md = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    out["meta_description"] = (md.get("content") or "").strip() if md else ""
    robots = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
    out["meta_robots"] = (robots.get("content") or "").strip().lower() if robots else ""
    can = soup.find("link", rel=re.compile(r"canonical", re.I))
    out["canonical"] = can.get("href", "").strip() if can else ""
    vp = soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)})
    out["viewport"] = bool(vp)
    out["html_lang"] = (soup.html.get("lang") or "").strip() if soup.html else ""
    out["hreflang"] = [{"lang": l.get("hreflang"), "href": l.get("href")}
                       for l in soup.find_all("link", rel="alternate") if l.get("hreflang")]
    h1s = [h.get_text(strip=True) for h in soup.find_all("h1")]
    out["h1"] = h1s
    out["h1_count"] = len(h1s)
    out["h2_count"] = len(soup.find_all("h2"))
    out["h3_count"] = len(soup.find_all("h3"))
    # JSON-LD types
    types = []
    for s in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(s.string or "")
            items = data if isinstance(data, list) else [data]
            for it in items:
                t = it.get("@type")
                if t:
                    types.append(t if isinstance(t, str) else str(t))
                for g in it.get("@graph", []) if isinstance(it, dict) else []:
                    t2 = g.get("@type")
                    if t2:
                        types.append(t2 if isinstance(t2, str) else str(t2))
        except Exception:
            types.append("PARSE_ERROR")
    out["jsonld_types"] = types
    # images
    imgs = soup.find_all("img")
    out["img_total"] = len(imgs)
    out["img_missing_alt"] = sum(1 for i in imgs if not i.get("alt"))
    # links
    base_host = urllib.parse.urlparse(base_url).netloc.replace("www.", "")
    internal, external, ext_hosts = 0, 0, set()
    article_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absu = urllib.parse.urljoin(base_url, href)
        host = urllib.parse.urlparse(absu).netloc.replace("www.", "")
        if host == base_host:
            internal += 1
            if ARTICLE_PAT.search(urllib.parse.urlparse(absu).path):
                article_links.append(absu)
        elif host:
            external += 1
            ext_hosts.add(host)
    out["internal_links"] = internal
    out["external_links"] = external
    out["external_hosts"] = sorted(ext_hosts)[:30]
    out["article_link_candidates"] = list(dict.fromkeys(article_links))[:15]
    # OG / Twitter
    og = {}
    for m in soup.find_all("meta"):
        p = m.get("property") or m.get("name") or ""
        if p.startswith("og:"):
            og[p] = m.get("content", "")
        elif p.startswith("twitter:"):
            og[p] = m.get("content", "")
    out["og"] = {k: v for k, v in og.items() if k in (
        "og:title", "og:description", "og:image", "og:url", "og:type",
        "og:site_name", "twitter:card", "twitter:title", "twitter:image")}
    out["favicon"] = bool(soup.find("link", rel=re.compile(r"icon", re.I)))
    # RSS discovery
    rss = [l.get("href") for l in soup.find_all("link", attrs={"type": re.compile(r"rss|atom", re.I)})]
    for a in soup.find_all("a", href=True):
        if re.search(r"(rss|feed|atom)", a["href"], re.I):
            rss.append(a["href"])
    out["rss_candidates"] = list(dict.fromkeys(rss))[:5]
    # text analysis
    visible = soup.get_text(" ", strip=True)
    out["word_count"] = text_len(BeautifulSoup(html, "html.parser"))
    leaks = []
    for pat in (r"<!\[CDATA\[", r"<p>", r"<img\s", r"<br\s*/?>", r"&lt;[a-z]+&gt;"):
        if re.search(pat, visible):
            leaks.append(pat)
    out["raw_html_leaks"] = leaks
    jargon = [w for w in INTERNAL_JARGON if w in visible]
    out["internal_jargon"] = jargon
    out["has_mailto"] = "mailto:" in html
    out["has_search_form"] = bool(soup.find("form", attrs={"role": "search"})) or \
        bool(soup.find("input", attrs={"type": "search"})) or \
        bool(soup.find("form", action=re.compile(r"search", re.I)))
    # SSR check: substantial visible text without JS
    out["ssr_ok"] = out["word_count"] > 500
    # nosnippet / max-snippet
    out["nosnippet"] = "nosnippet" in out["meta_robots"]
    # author byline
    out["author_meta"] = bool(soup.find("meta", attrs={"name": re.compile(r"author", re.I)}))
    # schema FAQ
    out["has_faq_schema"] = any("FAQ" in t for t in types)
    # time elements
    out["time_elements"] = len(soup.find_all("time"))
    return out


def parse_robots(text):
    """Return dict: ai_crawler_verdicts, sitemaps, disallow_all."""
    groups = []  # list of (agents, rules)
    cur_agents, cur_rules = [], []
    for line in text.splitlines():
        line = line.split("#")[0].strip()
        if not line:
            if cur_agents or cur_rules:
                groups.append((cur_agents, cur_rules))
                cur_agents, cur_rules = [], []
            continue
        m = re.match(r"(user-agent|disallow|allow|sitemap|crawl-delay)\s*:\s*(.*)", line, re.I)
        if not m:
            continue
        k, v = m.group(1).lower(), m.group(2).strip()
        if k == "user-agent":
            if cur_rules:
                groups.append((cur_agents, cur_rules))
                cur_rules = []
            cur_agents.append(v.lower())
        elif k == "sitemap":
            groups.append((["__sitemap__"], [v]))
        else:
            cur_rules.append((k, v))
    if cur_agents or cur_rules:
        groups.append((cur_agents, cur_rules))
    sitemaps = [r[0] for agents, rules in groups for r in [(ru[1] if isinstance(ru, tuple) else ru,) for ru in rules] for r in r if agents == ["__sitemap__"]]
    sitemaps = [rules for agents, rules in groups if agents == ["__sitemap__"] for rules in rules]
    verdicts = {}
    for bot in AI_CRAWLERS:
        b = bot.lower()
        status = "allowed-default"
        for agents, rules in groups:
            if agents == ["__sitemap__"]:
                continue
            if b in agents or (b.split("-")[0] in agents and len(b.split("-")[0]) > 4):
                for k, v in rules:
                    if k == "disallow" and v == "/":
                        status = "blocked"
                    elif k == "allow" and v == "/":
                        status = "allowed"
        # wildcard group applies if no specific group matched
        if status == "allowed-default":
            for agents, rules in groups:
                if "*" in agents:
                    for k, v in rules:
                        if k == "disallow" and v == "/":
                            status = "blocked-by-wildcard"
        verdicts[bot] = status
    disallow_all = any("*" in agents and any(k == "disallow" and v == "/" for k, v in rules)
                     for agents, rules in groups)
    return {"ai_crawlers": verdicts, "sitemaps": sitemaps, "disallow_all_wildcard": disallow_all}


def audit_site(name, domain):
    base = f"https://{domain}"
    res = {"name": name, "domain": domain, "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
           "issues": [], "pages": {}, "checks": {}}

    def issue(sev, cat, msg, zyppy=""):
        res["issues"].append({"severity": sev, "category": cat, "detail": msg, "zyppy": zyppy})

    # --- redirects ---
    http_r = fetch(f"http://{domain}", method="HEAD")
    res["checks"]["http_to_https"] = {
        "status": http_r.get("status"), "final": http_r.get("url"), "history": http_r.get("history")}
    www_r = fetch(f"https://www.{domain}", method="HEAD")
    res["checks"]["www_redirect"] = {
        "status": www_r.get("status"), "final": www_r.get("url"), "history": www_r.get("history")}

    # --- homepage ---
    home = fetch(base + "/")
    res["pages"]["home"] = {"status": home.get("status"), "elapsed_ms": home.get("elapsed_ms"),
                            "final_url": home.get("url"), "error": home.get("error")}
    if not home.get("ok") or home.get("status", 0) >= 400:
        issue("critical", "availability", f"首页不可用: {home.get('status')} {home.get('error','')}")
        return res
    if home.get("elapsed_ms", 0) > 2500:
        issue("high", "performance", f"首页 TTFB {home['elapsed_ms']}ms > 2500ms", "Site Speed +1.23")
    elif home.get("elapsed_ms", 0) > 1200:
        issue("medium", "performance", f"首页 TTFB {home['elapsed_ms']}ms 偏慢", "Site Speed +1.23")

    hdrs = {k.lower(): v for k, v in home.get("headers", {}).items()}
    res["checks"]["security_headers"] = {
        h: hdrs.get(h) for h in
        ("strict-transport-security", "content-security-policy", "x-content-type-options",
         "x-frame-options", "referrer-policy", "permissions-policy")}
    if "strict-transport-security" not in hdrs:
        issue("medium", "security", "缺少 HSTS 响应头", "HTTPS +1.28")
    if "x-content-type-options" not in hdrs:
        issue("low", "security", "缺少 X-Content-Type-Options")
    if not hdrs.get("x-frame-options") and "frame-ancestors" not in hdrs.get("content-security-policy", ""):
        issue("low", "security", "缺少 X-Frame-Options / frame-ancestors")

    info = analyze_html(home["text"], base + "/")
    res["pages"]["home"].update(info)
    if not info["title"]:
        issue("critical", "onpage", "首页缺 <title>", "Title Relevance +2.26")
    elif len(info["title"]) > 65:
        issue("low", "onpage", f"首页 title 过长 ({len(info['title'])} 字符)", "Title Relevance +2.26")
    if not info["meta_description"]:
        issue("medium", "onpage", "首页缺 meta description", "Meta Description +0.22")
    if info["h1_count"] == 0:
        issue("high", "onpage", "首页缺 H1", "H1 Keywords +1.67")
    elif info["h1_count"] > 1:
        issue("medium", "onpage", f"首页有 {info['h1_count']} 个 H1", "H1 Keywords +1.67")
    if not info["canonical"]:
        issue("medium", "technical", "首页缺 canonical", "Canonicalization +1.56")
    if "noindex" in info["meta_robots"]:
        res["checks"]["indexing"] = "noindex-on-home"
        issue("critical", "indexing", "首页 meta robots 为 noindex — 全站不可收录", "Technical")
    else:
        res["checks"]["indexing"] = "index-ok"
    if not info["viewport"]:
        issue("high", "ux", "缺 viewport — 移动端不可用", "Mobile Usability +1.66")
    if not info["ssr_ok"]:
        issue("high", "technical", f"首页可见文本仅 {info['word_count']} 字符 — 可能依赖 JS 渲染", "Client-side JS -1.04")
    if info["img_total"] and info["img_missing_alt"] / max(info["img_total"], 1) > 0.3:
        issue("medium", "images", f"首页 {info['img_missing_alt']}/{info['img_total']} 图片缺 alt", "Image Alt +0.77")
    if info["raw_html_leaks"]:
        issue("high", "content", f"首页可见文本出现原始 HTML 残留: {info['raw_html_leaks']}", "Content Quality")
    if info["internal_jargon"]:
        issue("high", "brand", f"公开页出现不该露出的词: {info['internal_jargon']}", "Trust")
    if not info["has_mailto"]:
        issue("medium", "brand", "首页无 mailto 联系方式", "Contact Info +1.09")
    if not info["has_search_form"]:
        issue("low", "ux", "首页未发现搜索表单")
    if "og:image" not in info["og"]:
        issue("low", "social", "缺 og:image")
    if not info["jsonld_types"]:
        issue("medium", "schema", "首页无 JSON-LD 结构化数据", "Structured Data +0.96")
    res["checks"]["home_jsonld"] = info["jsonld_types"]

    # --- robots.txt ---
    rb = fetch(base + "/robots.txt")
    if not rb.get("ok") or rb.get("status", 0) != 200:
        issue("medium", "technical", f"robots.txt 不可用 ({rb.get('status')})", "robots -2.22")
        res["checks"]["robots"] = {"status": rb.get("status")}
    else:
        parsed = parse_robots(rb["text"])
        res["checks"]["robots"] = {"status": 200, **parsed}
        if parsed["disallow_all_wildcard"]:
            issue("critical", "indexing", "robots.txt 对所有 UA Disallow: /", "robots -2.22")
        blocked_key = [b for b, v in parsed["ai_crawlers"].items() if v == "blocked"]
        if blocked_key:
            issue("medium", "geo", f"robots.txt 屏蔽 AI 爬虫: {blocked_key}",
                  "AI Crawl Access +2.20")
        if not parsed["sitemaps"]:
            issue("medium", "technical", "robots.txt 未声明 Sitemap")

    # --- sitemap ---
    sm_url = None
    if res["checks"].get("robots", {}).get("sitemaps"):
        sm_url = res["checks"]["robots"]["sitemaps"][0]
    else:
        sm_url = base + "/sitemap.xml"
    sm = fetch(sm_url)
    sitemap_urls = []
    if not sm.get("ok") or sm.get("status", 0) != 200 or "<" not in sm.get("text", ""):
        issue("high", "technical", f"Sitemap 不可用: {sm_url} ({sm.get('status')})", "Sitemap +0.80")
        res["checks"]["sitemap"] = {"status": sm.get("status"), "url": sm_url}
    else:
        text = sm["text"]
        is_index = "<sitemapindex" in text
        child_locs = re.findall(r"<loc>\s*([^<]+)\s*</loc>", text)
        total_urls = 0
        if is_index:
            res["checks"]["sitemap_index_children"] = len(child_locs)
            for child in child_locs[:5]:
                cs = fetch(child.strip())
                if cs.get("ok") and cs.get("status") == 200:
                    urls = re.findall(r"<loc>\s*([^<]+)\s*</loc>", cs["text"])
                    total_urls += len(urls)
                    sitemap_urls += urls[:8]
            res["checks"]["sitemap"] = {"status": 200, "url": sm_url, "type": "index",
                                        "children": len(child_locs),
                                        "sampled_urls": total_urls}
        else:
            total_urls = len(child_locs)
            sitemap_urls = child_locs[:10]
            res["checks"]["sitemap"] = {"status": 200, "url": sm_url, "type": "urlset",
                                        "urls": total_urls}
        if is_index and res["checks"]["sitemap_index_children"] == 0:
            issue("high", "technical", "sitemap index 为空")
        # freshness of lastmod
        lastmods = re.findall(r"<lastmod>\s*([^<]+)\s*</lastmod>", text)
        res["checks"]["sitemap_lastmod_sample"] = lastmods[:5]

    # --- llms.txt ---
    llms = fetch(base + "/llms.txt")
    res["checks"]["llms_txt"] = {"status": llms.get("status"),
                                 "bytes": len(llms.get("text", ""))}
    if llms.get("status") != 200:
        issue("low", "geo", "无 llms.txt", "llms.txt +0.05 (低权重)")

    # --- RSS ---
    rss_ok, rss_url = False, None
    for cand in info["rss_candidates"] + ["/rss", "/feed", "/rss.xml", "/feed.xml", "/atom.xml"]:
        u = urllib.parse.urljoin(base + "/", cand)
        fr = fetch(u)
        if fr.get("ok") and fr.get("status") == 200 and re.search(r"<(rss|feed|channel)", fr.get("text", "")[:2000], re.I):
            rss_ok, rss_url = True, u
            break
    res["checks"]["rss"] = {"ok": rss_ok, "url": rss_url}
    if not rss_ok:
        issue("medium", "distribution", "未发现可用 RSS feed")

    # --- article pages ---
    article_urls = []
    for u in sitemap_urls:
        if ARTICLE_PAT.search(urllib.parse.urlparse(u).path):
            article_urls.append(u)
    for u in info["article_link_candidates"]:
        article_urls.append(u)
    article_urls = list(dict.fromkeys(article_urls))[:4]
    res["checks"]["article_samples"] = []
    noindexed_articles = 0
    for au in article_urls:
        pa = fetch(au)
        rec = {"url": au, "status": pa.get("status"), "elapsed_ms": pa.get("elapsed_ms")}
        if pa.get("ok") and pa.get("status") == 200:
            ai = analyze_html(pa["text"], au)
            rec.update({k: ai[k] for k in (
                "title", "meta_robots", "canonical", "h1", "h1_count", "jsonld_types",
                "word_count", "img_total", "img_missing_alt", "raw_html_leaks",
                "internal_links", "external_links", "time_elements", "has_faq_schema",
                "external_hosts", "og")})
            if "noindex" in ai["meta_robots"]:
                noindexed_articles += 1
                rec["noindex"] = True
            if ai["word_count"] < 300:
                issue("medium", "content", f"文章页正文过薄 ({ai['word_count']} 字符): {au}",
                      "Thin content")
            if not any("Article" in t or "NewsArticle" in t for t in ai["jsonld_types"]):
                rec["article_schema"] = False
            else:
                rec["article_schema"] = True
            if ai["raw_html_leaks"]:
                issue("high", "content", f"文章页出现 HTML 残留 {ai['raw_html_leaks']}: {au}")
            if not ai["external_links"]:
                rec["no_external_links"] = True
            if pa.get("elapsed_ms", 0) > 2500:
                issue("medium", "performance", f"文章页 TTFB {pa['elapsed_ms']}ms: {au}")
        else:
            issue("high", "availability", f"文章页不可访问 {pa.get('status')}: {au}")
        res["checks"]["article_samples"].append(rec)
    res["checks"]["articles_found"] = len(article_urls)
    if not article_urls:
        issue("high", "structure", "首页与 Sitemap 均未发现文章页链接", "Content")
    if noindexed_articles:
        issue("medium", "indexing",
              f"{noindexed_articles}/{len(article_urls)} 抽样文章页为 noindex（若为转载属预期，若为原创属问题）")

    # --- archive / library page ---
    for path in ("/archive", "/news", "/library", "/articles", "/all"):
        ar = fetch(base + path)
        if ar.get("ok") and ar.get("status") == 200 and len(ar.get("text", "")) > 2000:
            ai = analyze_html(ar["text"], base + path)
            rec = {"path": path, "robots": ai["meta_robots"], "title": ai["title"],
                   "canonical": ai["canonical"], "word_count": ai["word_count"]}
            # page 2
            p2 = fetch(base + path + "?page=2")
            if p2.get("ok") and p2.get("status") == 200:
                ai2 = analyze_html(p2["text"], base + path + "?page=2")
                rec["page2"] = {"robots": ai2["meta_robots"], "title": ai2["title"],
                                "canonical": ai2["canonical"]}
                if "noindex" not in ai2["meta_robots"]:
                    issue("medium", "indexing",
                          f"{path}?page=2 未 noindex — 分页页可能产生重复收录", "Duplicate -1.19")
            res["checks"]["archive"] = rec
            break

    # --- 404 ---
    nf = fetch(base + "/definitely-not-exists-zzz-2026")
    res["checks"]["404"] = {"status": nf.get("status"),
                            "branded": bool(nf.get("text")) and ("404" in nf["text"] or "not" in nf["text"].lower())}
    if nf.get("status") == 200:
        issue("high", "technical", "不存在的路径返回 200 — 软 404 风险", "Soft 404")

    # --- about / contact ---
    about_ok = False
    for path in ("/about", "/about-us", "/contact", "/about/"):
        ab = fetch(base + path)
        if ab.get("ok") and ab.get("status") == 200 and len(ab.get("text", "")) > 1000:
            about_ok = True
            res["checks"]["about_page"] = path
            break
    if not about_ok:
        issue("medium", "brand", "未发现 About/联系页面", "Trust +2.01")

    return res


def load_lines(path):
    lines = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            lines.append(line)
    return lines


def load_sites(path):
    sites = []
    for line in load_lines(path):
        if "," in line:
            name, domain = [part.strip() for part in line.split(",", 1)]
        else:
            name, domain = "", line.strip()
        domain = domain.replace("https://", "").replace("http://", "").strip().strip("/")
        domain = domain.split("/")[0]
        if not domain:
            continue
        if not name:
            name = domain
        sites.append((name, domain))
    return sites


def main():
    if len(sys.argv) < 2:
        sys.exit("用法: python3 scripts/audit.py <站点名单.txt> [结果目录] [敏感词.txt]")
    sites = load_sites(sys.argv[1])
    if not sites:
        sys.exit("站点名单是空的")
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "results"
    os.makedirs(out_dir, exist_ok=True)
    global INTERNAL_JARGON
    if len(sys.argv) > 3:
        INTERNAL_JARGON = list(dict.fromkeys(INTERNAL_JARGON + load_lines(sys.argv[3])))
    results = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(audit_site, n, d): n for n, d in sites}
        for fut in as_completed(futs):
            n = futs[fut]
            try:
                r = fut.result()
            except Exception as e:
                r = {"name": n, "error": str(e), "issues": [{"severity": "critical",
                     "category": "audit", "detail": f"审计脚本异常: {e}", "zyppy": ""}]}
            results[n] = r
            with open(f"{out_dir}/{n}.json", "w", encoding="utf-8") as f:
                json.dump(r, f, ensure_ascii=False, indent=2)
            sev = {}
            for i in r.get("issues", []):
                sev[i["severity"]] = sev.get(i["severity"], 0) + 1
            print(f"[done] {n}: {sev}", flush=True)
    print("ALL DONE")


if __name__ == "__main__":
    main()
