# 网站 SEO / GEO 检查

先看 [Zyppy 2026 的 101 项](docs/zyppy-2026-101.md)。这是检查用的因素表：自然搜索 88 项加 Google AI 13 项，分数来自 [2026 专家调查](https://signal.zyppy.com/p/google-ranking-factors-expert-survey)。技术项是门槛；意图匹配、高信任外链、原创研究、全站质量、品牌搜索、主题权威要靠内容和站外声誉。

下面三样是拿这张表去核对的办法。

## 要素清单

[网站 SEO 要素检查](docs/网站SEO要素检查.md) 写的是人要过的项目：能不能被抓取、标题和描述、规范链接、站点地图、结构化数据、分享信息、多语言、内链和 404。后半部分是这些地方最常出的问题，以及该怎么核对。

## 自动检查门禁

[SEO自动检查门禁](SEO自动检查门禁/README.md) 按一份配置检查代表页、站点地图、链接、结构化数据和线上抓取是否一致。适合放进上线流程：部署前跑本地，部署后再跑线上。

```bash
cd SEO自动检查门禁
pnpm install
pnpm run seo:audit -- --config examples/seo-gate.config.json
```

示例配置里的域名是 `example.com`。换成自己的站再跑。检查项见 [检查项清单](SEO自动检查门禁/docs/检查项清单.md)。

## 网页自检

`scripts/audit.py` 对着公开网址抓一遍，看首页、收录开关、站点地图、RSS、llms.txt、AI 爬虫和抽样正文。看哪些在查、哪些查不了：[检查清单](docs/检查清单.md)。

```bash
pip install -r requirements.txt
python3 scripts/audit.py sites.example.txt results
python3 scripts/build_report.py results report
```

`sites.example.txt` 一行一个域名。报告在 `report/report.md` 和 `report/report.html`。

已经用 `example.com` 和 `www.iana.org` 跑过一版，可以直接看 [示例报告](examples/report.md)。用浏览器打开 [examples/report.html](examples/report.html) 是同一份的页面版。

如果有些词不该出现在公开页上，按 `jargon.example.txt` 另写一份：

```bash
python3 scripts/audit.py sites.example.txt results jargon.example.txt
```

## 许可

MIT，见 `LICENSE`。
