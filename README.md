# 网站 SEO / GEO 自检

对着公开网页做检查，看页面本身有没有明显缺口。覆盖搜索和 AI 搜索都会看的部分：标题、规范链接、HTTPS、robots、站点地图、结构化数据、图片说明、联系入口、AI 爬虫能不能进来、llms.txt。

外链、品牌搜索量和用户行为不在这里，那些要另外接搜索后台。

## 怎么用

1. 安装 Python 3。
2. 安装依赖：`pip install -r requirements.txt`
3. 复制 `sites.example.txt`，改成要检查的域名。
4. 运行：

```bash
python3 scripts/audit.py sites.example.txt results
```

每个站会得到一份 JSON。`issues` 里是发现的问题，严重程度分为 critical、high、medium、low。

如果有些词不该出现在公开页面上，按 `jargon.example.txt` 的格式另写一份，检查时带上：

```bash
python3 scripts/audit.py sites.example.txt results jargon.example.txt
```

不传词表时，只检查页面上有没有露出 localhost 和 127.0.0.1。

检查结果写在本机的 `results/` 里，不会随这个仓库一起发布。

## 许可

MIT，见 `LICENSE`。
