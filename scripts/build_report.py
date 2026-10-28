#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 audit.py 写出的 JSON 收成一份能直接看的报告。

用法: python3 scripts/build_report.py <结果目录> <输出目录>
"""
import html
import json
import os
import sys
from datetime import date

PENALTY = {"critical": 25, "high": 12, "medium": 6, "low": 2}
SEV_NAME = {"critical": "严重", "high": "高", "medium": "中", "low": "低"}
SEV_ORDER = ("critical", "high", "medium", "low")


def esc(value):
    return html.escape(str(value if value is not None else ""), quote=True)


def load_results(folder):
    rows = []
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".json") or name.startswith("_"):
            continue
        with open(os.path.join(folder, name), encoding="utf-8") as handle:
            rows.append(json.load(handle))
    if not rows:
        sys.exit(f"{folder} 里没有检查结果")
    return rows


def health(issues):
    score = 100
    for item in issues:
        score -= PENALTY.get(item.get("severity"), 0)
    return max(0, score)


def band(score):
    if score >= 85:
        return "g"
    if score >= 70:
        return "y"
    if score >= 55:
        return "o"
    return "r"


def yes_no(flag):
    return "有" if flag else "没有"


def site_facts(row):
    home = row.get("pages", {}).get("home", {})
    checks = row.get("checks", {})
    robots = checks.get("robots", {})
    crawlers = robots.get("ai_crawlers", {})
    blocked = [name for name, state in crawlers.items() if state == "blocked"]
    sitemap = checks.get("sitemap", {})
    return {
        "title": home.get("title") or "（没有标题）",
        "description": home.get("meta_description") or "（没有描述）",
        "h1": "、".join(home.get("h1") or []) or "（没有 H1）",
        "canonical": home.get("canonical") or "（没有）",
        "indexing": checks.get("indexing") or "未知",
        "speed": home.get("elapsed_ms"),
        "words": home.get("word_count"),
        "jsonld": "、".join(checks.get("home_jsonld") or []) or "（没有）",
        "sitemap": sitemap.get("status"),
        "sitemap_urls": sitemap.get("urls", sitemap.get("sampled_urls", "—")),
        "rss": (checks.get("rss") or {}).get("ok"),
        "llms": (checks.get("llms_txt") or {}).get("status"),
        "blocked": blocked,
        "crawler_total": len(crawlers),
        "not_found": (checks.get("404") or {}).get("status"),
        "about": checks.get("about_page") or "（没找到）",
        "mailto": home.get("has_mailto"),
        "articles": checks.get("articles_found", 0),
    }


def markdown_report(rows):
    lines = [
        "# 示例报告",
        "",
        "这是用公开示例站跑出来的一份结果，用来看报告长什么样。",
        "健康分只按这次自动检查扣分，不是搜索排名预测。",
        "",
        f"生成日期：{date.today().isoformat()}",
        "",
        "## 总览",
        "",
        "| 站点 | 健康分 | 首页速度 | 问题（严重/高/中/低） | 站点地图 | RSS | llms.txt |",
        "|---|---:|---:|---|---|---|---|",
    ]
    for row in rows:
        issues = row.get("issues", [])
        counts = {name: sum(1 for item in issues if item.get("severity") == name) for name in SEV_ORDER}
        facts = site_facts(row)
        count_text = "/".join(str(counts[name]) for name in SEV_ORDER)
        lines.append(
            f"| {row.get('domain')} | {health(issues)} | {facts['speed'] or '—'} ms | {count_text} | "
            f"{facts['sitemap'] or '—'} | {yes_no(facts['rss'])} | {facts['llms'] or '—'} |"
        )
    lines += ["", "## 各站看到了什么", ""]
    for row in rows:
        facts = site_facts(row)
        issues = row.get("issues", [])
        lines += [
            f"### {row.get('domain')}",
            "",
            f"- 健康分：{health(issues)}",
            f"- 标题：{facts['title']}",
            f"- 描述：{facts['description']}",
            f"- H1：{facts['h1']}",
            f"- 规范链接：{facts['canonical']}",
            f"- 首页是否允许收录：{facts['indexing']}",
            f"- 首页可见文字：{facts['words'] or '—'} 字",
            f"- 结构化数据：{facts['jsonld']}",
            f"- 抽到的文章：{facts['articles']} 篇",
            f"- 关于/联系页：{facts['about']}",
            f"- 首页有没有联系入口：{yes_no(facts['mailto'])}",
            f"- 不存在的地址返回：{facts['not_found'] or '—'}",
            f"- AI 爬虫被明确拦住：{len(facts['blocked'])} / {facts['crawler_total']}",
            "",
            "**问题**",
            "",
        ]
        if not issues:
            lines.append("- 这次自动检查没有发现问题。")
        else:
            for item in sorted(issues, key=lambda issue: SEV_ORDER.index(issue.get("severity", "low"))):
                label = SEV_NAME.get(item.get("severity"), item.get("severity"))
                hint = f"（{item['zyppy']}）" if item.get("zyppy") else ""
                lines.append(f"- {label} · {item.get('detail')}{hint}")
        lines.append("")
    lines += [
        "## 这份报告没有覆盖的事",
        "",
        "外链质量、品牌被搜索的次数、用户是否满意，都要另外接搜索后台，不能只看网页。",
        "",
    ]
    return "\n".join(lines)


def html_report(rows):
    cards = []
    issue_rows = []
    summary = []
    totals = {name: 0 for name in SEV_ORDER}
    for row in rows:
        issues = row.get("issues", [])
        facts = site_facts(row)
        score = health(issues)
        counts = {name: sum(1 for item in issues if item.get("severity") == name) for name in SEV_ORDER}
        for name in SEV_ORDER:
            totals[name] += counts[name]
        count_text = "/".join(str(counts[name]) for name in SEV_ORDER)
        summary.append(
            f"<tr><td><b>{esc(row.get('domain'))}</b></td>"
            f"<td><span class='score {band(score)}'>{score}</span></td>"
            f"<td>{esc(facts['speed'] or '—')} ms</td>"
            f"<td>{esc(facts['title'])}</td>"
            f"<td>{esc(count_text)}</td>"
            f"<td>{esc(facts['sitemap'] or '—')}</td>"
            f"<td>{yes_no(facts['rss'])}</td>"
            f"<td>{esc(facts['llms'] or '—')}</td></tr>"
        )
        items = []
        for item in issues:
            label = SEV_NAME.get(item.get("severity"), "")
            items.append(
                f"<li><span class='tag {esc(item.get('severity'))}'>{esc(label)}</span> "
                f"{esc(item.get('detail'))}</li>"
            )
            issue_rows.append(
                "<tr>"
                f"<td><span class='tag {esc(item.get('severity'))}'>{esc(label)}</span></td>"
                f"<td>{esc(row.get('domain'))}</td>"
                f"<td>{esc(item.get('detail'))}</td>"
                f"<td class='hint'>{esc(item.get('zyppy') or '')}</td>"
                "</tr>"
            )
        if not items:
            items.append("<li>这次自动检查没有发现问题。</li>")
        cards.append(
            "<article class='card'>"
            f"<header><h3>{esc(row.get('domain'))}</h3>"
            f"<span class='score {band(score)}'>{score}</span></header>"
            f"<p>标题：{esc(facts['title'])}<br>"
            f"H1：{esc(facts['h1'])}<br>"
            f"规范链接：{esc(facts['canonical'])}<br>"
            f"结构化数据：{esc(facts['jsonld'])}<br>"
            f"文章样本 {esc(facts['articles'])} 篇 · 关于页 {esc(facts['about'])} · "
            f"404 状态 {esc(facts['not_found'] or '—')}<br>"
            f"AI 爬虫被明确拦住 {len(facts['blocked'])} / {facts['crawler_total']}</p>"
            f"<ul>{''.join(items)}</ul></article>"
        )
    stats = "".join(
        f"<div class='stat'><b>{totals[name]}</b><span>{SEV_NAME[name]}</span></div>"
        for name in SEV_ORDER
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>网站 SEO / GEO 自检示例报告</title>
<style>
:root {{ --bg:#f4f6f8; --card:#fff; --line:#e4e7ec; --tx:#1a1f2c; --sub:#667085;
--r:#d92d20; --o:#f79009; --g:#12b76a; --b:#2e90fa; }}
* {{ box-sizing:border-box; margin:0; }}
body {{ font:15px/1.65 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
background:var(--bg); color:var(--tx); padding:32px 20px; }}
.wrap {{ max-width:1080px; margin:auto; }}
h1 {{ font-size:28px; letter-spacing:-0.03em; }}
h2 {{ font-size:18px; margin:36px 0 12px; }}
.sub {{ color:var(--sub); margin:8px 0 20px; }}
.stats {{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }}
.stat,.card,table {{ background:var(--card); border:1px solid var(--line); border-radius:12px; }}
.stat {{ padding:14px 16px; }}
.stat b {{ display:block; font-size:26px; }}
.stat span,.hint {{ color:var(--sub); font-size:12px; }}
table {{ width:100%; border-collapse:collapse; overflow:hidden; }}
th,td {{ padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }}
th {{ background:#eef1f5; font-size:12px; color:#475467; }}
.score {{ display:inline-block; min-width:36px; text-align:center; color:#fff; font-weight:700;
border-radius:6px; padding:2px 6px; }}
.score.g {{ background:var(--g); }} .score.y {{ background:#ca9a04; }}
.score.o {{ background:var(--o); }} .score.r {{ background:var(--r); }}
.tag {{ display:inline-block; border-radius:4px; padding:1px 7px; color:#fff; font-size:11px; font-weight:700; }}
.tag.critical {{ background:var(--r); }} .tag.high {{ background:var(--o); }}
.tag.medium {{ background:#ca9a04; }} .tag.low {{ background:#98a2b3; }}
.grid {{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }}
.card {{ padding:16px; }}
.card header {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }}
.card p,.card li {{ font-size:13px; }}
.card ul {{ list-style:none; padding:0; margin-top:10px; }}
.card li {{ margin:6px 0; }}
.note {{ background:#eef4ff; border:1px solid #b2ddff; border-radius:12px; padding:14px 16px; }}
footer {{ color:var(--sub); font-size:12px; margin-top:28px; }}
@media (max-width:800px) {{ .stats,.grid {{ grid-template-columns:1fr; }} }}
</style></head><body><div class="wrap">
<h1>网站 SEO / GEO 自检示例</h1>
<p class="sub">用公开示例站跑出来的结果，用来看一份报告长什么样。健康分只按这次自动检查扣分，不是搜索排名预测。生成日期 {date.today().isoformat()}。</p>
<div class="stats">{stats}</div>
<h2>总览</h2>
<table><thead><tr><th>站点</th><th>健康分</th><th>首页速度</th><th>标题</th><th>问题（严重/高/中/低）</th><th>站点地图</th><th>RSS</th><th>llms.txt</th></tr></thead>
<tbody>{''.join(summary)}</tbody></table>
<h2>问题清单</h2>
<table><thead><tr><th>级别</th><th>站点</th><th>问题</th><th>对应的公开因素</th></tr></thead>
<tbody>{''.join(issue_rows) or '<tr><td colspan="4">没有问题</td></tr>'}</tbody></table>
<h2>分站</h2>
<div class="grid">{''.join(cards)}</div>
<h2>这份报告没有覆盖的事</h2>
<div class="note">外链质量、品牌被搜索的次数、用户是否满意，都要另外接搜索后台。只看网页，判断不了这些。</div>
<footer>由 scripts/audit.py 抓取，scripts/build_report.py 生成。</footer>
</div></body></html>
"""


def main():
    if len(sys.argv) < 3:
        sys.exit("用法: python3 scripts/build_report.py <结果目录> <输出目录>")
    rows = load_results(sys.argv[1])
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    md_path = os.path.join(out_dir, "report.md")
    html_path = os.path.join(out_dir, "report.html")
    with open(md_path, "w", encoding="utf-8") as handle:
        handle.write(markdown_report(rows))
    with open(html_path, "w", encoding="utf-8") as handle:
        handle.write(html_report(rows))
    print(md_path)
    print(html_path)


if __name__ == "__main__":
    main()
