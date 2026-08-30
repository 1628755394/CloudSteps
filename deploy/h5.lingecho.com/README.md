# h5.lingecho.com 维护发布

## 文件放置

| 路径 | 说明 |
|------|------|
| `/www/wwwroot/h5.lingecho.com/dist/` | 前端构建产物（nginx `root`） |
| `/www/wwwroot/h5.lingecho.com/maintenance.html` | 维护页（**不要**放进 `dist/`） |
| `/www/wwwroot/h5.lingecho.com/logo.png` | 维护页 logo（来自 `web/public/logo.png`） |
| `/www/wwwroot/h5.lingecho.com/wechat-biz-qr.png` | 客服二维码（来自 `web/public/wechat-biz-qr.png`） |
| `/www/wwwroot/h5.lingecho.com/maintenance.on` | 存在即开启维护（空文件） |

一次性拷贝：

```bash
SITE=/www/wwwroot/h5.lingecho.com
cp deploy/h5.lingecho.com/maintenance.html "$SITE/maintenance.html"
cp deploy/h5.lingecho.com/logo.png "$SITE/logo.png"
cp deploy/h5.lingecho.com/wechat-biz-qr.png "$SITE/wechat-biz-qr.png"
```

nginx 配置参考同目录 `nginx.conf.example`（含 `/logo.png`、`/wechat-biz-qr.png` 精确 location，维护模式下也能打开），改完后：

```bash
nginx -t && nginx -s reload
```

## 发布流程

```bash
# 1) 开维护
touch /www/wwwroot/h5.lingecho.com/maintenance.on
nginx -t && nginx -s reload

# 2) 更新后端 / 前端 / nginx
# ...

# 3) 关维护
rm -f /www/wwwroot/h5.lingecho.com/maintenance.on
nginx -t && nginx -s reload
```

## 行为

- 有 `maintenance.on`：页面 → `maintenance.html`；`/api` → JSON `503` + `maintenance: true`
- **还没有 `dist/index.html`（未发布前端）**：同样自动进维护页，避免 nginx `root` 指到不存在目录时直接 **500**
- 无开关但后端挂了：页面请求若走到 502/504 也会落到 `maintenance.html`；`/api` 仍返回真实 502（不劫持成 HTML）
- logo / 二维码走站点本机文件，不依赖 CDN

确保这三份在站点根（与 `dist` 同级），否则 `error_page` 也会变成 500：

```bash
ls -l /www/wwwroot/h5.lingecho.com/{maintenance.html,logo.png,wechat-biz-qr.png}
```
