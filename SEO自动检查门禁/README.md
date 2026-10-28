# 自动检查门禁

上线前、上线后都能跑的一套检查。用一份配置写明域名、代表页、站点地图和规则，不必把站点写进代码。

它对应 [要素清单](../docs/网站SEO要素检查.md) 里可以自动核对的部分：标题、描述、规范链接、H1、分享信息、结构化数据、图片说明、站点地图、robots、llms.txt、内链是否打得开、搜索引擎抓到的标题是否和浏览器一致。

## 先改配置

复制 `examples/seo-gate.config.json`，把 `example.com` 换成你的域名，再按站点补代表页和站点地图。

```bash
cd SEO自动检查门禁
pnpm install
pnpm run seo:audit -- --config examples/seo-gate.config.json
```

部署前如果本机已经能把站点跑起来，在配置里写上 `localVerify`，然后：

```bash
pnpm run seo:verify -- --config seo-gate.config.json
```

## 常用命令

```bash
pnpm run seo:audit -- --config seo-gate.config.json
pnpm run seo:audit:fresh -- --config seo-gate.config.json
pnpm run seo:links -- --config seo-gate.config.json
pnpm run seo:cache:clear -- --config seo-gate.config.json
pnpm run seo:indexnow -- --config seo-gate.config.json --dry-run
pnpm run seo:all -- --config seo-gate.config.json
```

`seo:audit` 会复用 `.seo-gate-cache/`。发版或月度巡检用 `seo:audit:fresh`，不读旧缓存，但会写下新结果。失败的项默认不进缓存，修完再跑会重新查。

## 文档

- [上手](docs/合作方上手指南.md)
- [检查项](docs/检查项清单.md)
