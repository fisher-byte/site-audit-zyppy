# 网站 SEO / GEO 检查

这个仓库把「什么重要」和「怎么核对」放在一处。先看因素，再用人眼清单过一遍，上线前后用门禁拦住，上线之后用网页自检看公开页面还缺什么。

## 基于什么

依据是 [2026 Google Ranking Factors Expert Survey](https://signal.zyppy.com/p/google-ranking-factors-expert-survey)（Cyrus Shepard、Dawn Shepard，2026-09-09）。131 位从业者给大约 103 个因素打分，从 -3 到 +3。因素名字以 [定义页](https://zyppy.com/ranking-factor-definitions/) 为准。

101 版取的是其中能拿来做一次检查的范围：

- 自然搜索八组，调查图表上对得上的 87 项
- 面包屑。101 版会查，调查没有单独给分
- Google AI 13 项。名字在定义页上；分数用 101 清单里与这些名字对应的一组。调查正文说这 13 项会另写，不在那篇自然搜索调查的图里

旁边用 First Page Sage 2025 的 12 条主因素做对照。那是另一套权重，不计入 101，也不是 Zyppy 这篇调查里的数字。

这张表的用法就一句话：技术、结构化和收录开关是门槛。Search Intent Match（+2.60）、高信任外链（+2.47）、原创研究（+2.19）、全站质量（+2.07）、品牌搜索（+1.98）、主题权威（+2.29）靠内容规模和站外声誉。只把模板补齐，这几项不会自己变高。页面上看不到的，写「数据不足」，不要估一个分。

全表在 [Zyppy 2026 的 101 项](docs/zyppy-2026-101.md)。

## 包括什么

| 部分 | 做什么 | 从哪看 |
|---|---|---|
| 因素表 | 101 项的名字、专家分、每项是看网页、读稿，还是要后台 | [docs/zyppy-2026-101.md](docs/zyppy-2026-101.md) |
| 要素清单 | 人眼要过的基础项、进阶项，以及站点地图、规范链接、内链、结构化数据、分享信息、多语言这些地方常见的错法 | [docs/网站SEO要素检查.md](docs/网站SEO要素检查.md) |
| 自动检查门禁 | 按一份配置查代表页、站点地图、链接、分享图和结构化数据；也可以比浏览器和搜索引擎抓到的标题是否一致。适合放进上线流程 | [SEO自动检查门禁](SEO自动检查门禁/README.md) |
| 网页自检 | 对着公开网址抓首页、收录开关、站点地图、RSS、llms.txt、AI 爬虫和抽样正文，收成一份报告 | [scripts/audit.py](scripts/audit.py)、[docs/检查清单.md](docs/检查清单.md) |
| 示例 | 用 example.com 和 www.iana.org 跑出来的一版，用来看报告长什么样 | [examples/report.md](examples/report.md) |

两个工具都只覆盖因素表里标成「网页」的项。读稿和后台的项，工具不下结论。

## 怎么用

1. 读 [因素表](docs/zyppy-2026-101.md)，先分清哪些是门槛，哪些必须读稿或接后台。
2. 用 [要素清单](docs/网站SEO要素检查.md) 把页面、站点地图、规范链接和多语言过一遍。
3. 上线前后跑门禁。示例配置里的域名是 `example.com`，换成自己的站再跑。

```bash
cd SEO自动检查门禁
pnpm install
pnpm run seo:audit -- --config examples/seo-gate.config.json
```

本机已经能把站点跑起来时，在配置里写上 `localVerify`，再用 `pnpm run seo:verify -- --config seo-gate.config.json`。检查项和接入步骤见 [检查项清单](SEO自动检查门禁/docs/检查项清单.md) 和 [上手指南](SEO自动检查门禁/docs/上手指南.md)。

4. 对线上地址做网页自检。

```bash
pip install -r requirements.txt
python3 scripts/audit.py sites.example.txt results
python3 scripts/build_report.py results report
```

`sites.example.txt` 一行一个域名，也可以写成 `名字,域名`。报告在 `report/report.md` 和 `report/report.html`。

如果有些词不该出现在公开页上，按 `jargon.example.txt` 的格式另写一份：

```bash
python3 scripts/audit.py sites.example.txt results jargon.example.txt
```

不传这份词表时，只检查页面上有没有露出 localhost 和 127.0.0.1。

## 许可

MIT，见 [LICENSE](LICENSE)。
