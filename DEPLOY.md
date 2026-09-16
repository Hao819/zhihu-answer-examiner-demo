# CloudBase 部署清单

本文档记录「答主考官」Demo 部署到腾讯云开发（CloudBase）HTTP 云函数的完整流程。

- 适用目录：本交付副本根目录
- 部署形态：HTTP 云函数（root 模式，无构建步骤）
- 运行时：`Nodejs20.19`
- 凭证策略：**运行时凭证只通过控制台环境变量注入，不写入源码与代码包**

---

## 1. 项目事实

| 项 | 值 | 依据 |
| --- | --- | --- |
| 函数名 | `zhihu-answer-examiner-demo` | `package.json#name` |
| 运行入口 | `server.js` | `package.json#scripts.start` |
| Node 版本要求 | `>=20` | `package.json#engines.node` |
| CloudBase 运行时 | `Nodejs20.19` | 官方推荐档，兼容 `engines` 声明 |
| 第三方依赖 | **无** | `package-lock.json` 仅 266 字节，无 `dependencies` |
| 构建步骤 | **无** | 源码直接运行，无打包产物 |
| 监听端口 | `9000` | CloudBase HTTP 云函数固定要求 |
| 监听地址 | `0.0.0.0` | 不可使用 `127.0.0.1` |

服务同时承担两件事：提供 `/api/*` 业务接口，以及作为静态文件服务器托管 `index.html`、`app.js`、`styles.css` 和 `docs/assets/` 下的图片资源。

### 对外接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/healthz` | 健康检查，返回凭证配置状态 |
| `POST` | `/api/search` | 知乎站内搜索 |
| `POST` | `/api/evaluate` | 知乎直答评估用户讲述 |
| `POST` | `/api/learn` | 生成零基础入门指南 |
| `POST` | `/api/reteach` | 针对单个知识点复测 |
| `GET` | `/*` | 静态资源 |

---

## 2. 前置条件

1. 已开通 CloudBase 环境，并记下环境 ID（`tcb env list` 可查）。
2. 已在[知乎开放平台个人中心](https://developer.zhihu.com/profile)获取 Access Secret。
3. 本地已安装 Node.js 20 及以上版本。

安装并登录 CLI：

```bash
npm install -g @cloudbase/cli
tcb login
```

`tcb login` 走浏览器授权获取临时密钥，是本地开发的推荐方式。CI 场景改用永久密钥非交互登录：

```bash
tcb login --apiKeyId $TENCENT_SECRET_ID --apiKey $TENCENT_SECRET_KEY
```

永久密钥在腾讯云访问管理 CAM 控制台创建，仅用于 CI 部署。**CI 步骤中不要 `echo` 密钥变量。**

查看环境列表与 CLI 版本：

```bash
tcb env list
tcb --version
```

---

## 3. 启动文件 `scf_bootstrap`

HTTP 云函数必须有 `scf_bootstrap` 作为 Web Server 启动入口。本副本已包含：

```bash
#!/bin/bash
export PORT=9000
export HOST=0.0.0.0
/var/lang/node20/bin/node server.js
```

官方规范要求（已逐项校验）：

- 文件名固定为 `scf_bootstrap`，无扩展名
- 首行必须是 `#!/bin/bash`
- 启动命令使用标准语言环境**绝对路径**（Node 20 为 `/var/lang/node20/bin/node`）
- 监听 `0.0.0.0`，端口 `9000`
- 换行符必须是 **LF**，不能是 CRLF
- 需要可执行权限（建议 `755`）

> **Windows 用户注意**：NTFS 不保留 Unix 可执行位，该文件在 Windows 上显示为 `0666`。CLI 打包上传通常会处理这一点；若部署后启动失败或报 `exec format error`，在 Linux/macOS 侧执行一次 `chmod 755 scf_bootstrap` 后重新部署。

---

## 4. 部署

### 方式一：使用配置文件（推荐）

副本内已提供 `cloudbaserc.local.json` 模板。填入环境 ID 后执行：

```bash
tcb fn deploy zhihu-answer-examiner-demo --yes
```

该模板**有意不包含 `envVariables`**，原因见第 6 节。

### 方式二：不使用配置文件

在副本根目录直接部署，CLI 会从 `package.json#name` 读取函数名：

```bash
tcb fn deploy --httpFn -e <你的环境ID> --install-dependency false --yes
```

### 常用参数

| 参数 | 作用 |
| --- | --- |
| `--httpFn` | 部署为 HTTP 云函数 |
| `-e, --env-id` | 指定环境 ID |
| `--install-dependency false` | 关闭云端装包（本项目零依赖，可加快部署） |
| `--yes` | 跳过交互确认，CI 中建议始终添加 |
| `--path /api` | 自动创建 HTTP 网关访问路径 |
| `--force` | 覆盖同名函数 |

### 两个不可逆的注意点

1. **函数类型不可变更。** 已部署为普通事件函数后无法改为 HTTP 函数，只能先删除再重新部署。首次部署务必确认 `type: HTTP` 或带上 `--httpFn`。
2. **`--force` 会同时覆盖函数配置和触发器。** 若已在控制台配好环境变量，避免用 `--force` 反复覆盖；环境变量配置建议放在首次部署**之后**。

---

## 5. 开启公网访问

部署时自动创建网关路径：

```bash
tcb fn deploy --httpFn -e <你的环境ID> --path /api --yes
```

或使用配置文件中的字段（模板已包含）：

| 字段 | 行为 |
| --- | --- |
| `public: true` | 自动放通匿名访问，无需登录即可通过 URL 调用 |
| `gatewayPath: "/api"` | 自动收敛 API 网关路由，幂等，重复部署不产生重复路由 |

也可在控制台「云函数 → 函数详情 → 访问配置」手动绑定。

---

## 6. 配置运行时凭证（关键步骤）

**控制台 → 云函数 → `zhihu-answer-examiner-demo` → 函数配置 → 环境变量 → 新增**

| 变量名 | 值 | 必填 |
| --- | --- | --- |
| `ZHIHU_ACCESS_SECRET` | 知乎开放平台 Access Secret | 是 |

说明：

- `PORT` 和 `HOST` 由 `scf_bootstrap` 导出，**不需要**在控制台配置。
- 直答模型档位已固化为 `zhida-thinking-1p5` 写在 `server.js` 中，**不需要**配置环境变量。
- 云函数环境变量**改完重新调用即生效**（实例热更新，不绑定版本），无需重新部署。

### 为什么不把凭证写进配置文件

CloudBase 官方密钥管理文档把「把 secret 写进代码」列为**首要反模式**：git 历史永远删不掉，轮换密钥也救不回来。因此本副本的 `cloudbaserc.local.json` 刻意不含 `envVariables`，`server.js` 保留 `process.env.ZHIHU_ACCESS_SECRET` 读取。

这个选择还规避了一个实际风险：`@cloudbase/cli` **2.12.0 以下**版本，配置文件中的 `envVariables` 会**完全覆盖**线上已有环境变量而非增量合并。由于模板不含该字段，重复部署不会误删控制台已配好的凭证。

若确实要通过配置文件下发环境变量，先用 `tcb --version` 确认版本，2.12.0 及以上支持选择增量或覆盖更新。

---

## 7. 验证部署

### 健康检查

```bash
curl https://<环境ID>.<网关域名>/api/healthz
```

预期返回：

```json
{"status":"ok","zhihuConfigured":true}
```

`zhihuConfigured` 为 `false` 表示环境变量未生效 —— 回控制台核对变量名拼写，然后重新调用一次函数。

### 业务链路

```bash
curl -X POST https://<环境ID>.<网关域名>/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"如何建立长期阅读习惯"}'
```

### 页面访问

浏览器直接打开网关地址根路径，应加载「答主考官」首页。

---

## 8. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `/healthz` 返回 `zhihuConfigured: false` | 环境变量未配置或名称拼错 | 控制台重新配置后再调用一次函数 |
| 接口返回 502 `zhihu_search_failed` | 上游 API 调用失败 | 查函数日志中 `[zhihu]` 前缀警告获取具体错误码 |
| 日志中 `API_20001` | 知乎鉴权失败 | Access Secret 无效或已重置，重新获取并更新环境变量 |
| 日志中 `API_30001` | 触发频率限制 | 停止重复调用，等待配额恢复 |
| 日志中 `AUTH_NOT_CONFIGURED` | 服务启动时未读到 Secret | 同第一行处理方式 |
| 启动失败 / `exec format error` | `scf_bootstrap` 缺少可执行权限或含 CRLF | `chmod 755 scf_bootstrap`，确认换行为 LF |
| 部署后 `process.env.X` 为 `undefined` | 环境变量未加或函数未重新部署 | 控制台加变量后重新触发调用 |
| 函数类型无法修改 | 类型部署后不可变更 | 删除原函数，以正确类型重新部署 |

查看实时日志：

```bash
tcb fn log zhihu-answer-examiner-demo -e <你的环境ID>
```

---

## 9. 交付副本文件清单

```
.env.example                    环境变量模板（不含真实值）
.gitignore                      含 cloudbaserc.local.json 排除规则
cloudbaserc.local.json          CLI 部署配置（不含凭证，已被 git 排除）
scf_bootstrap                   HTTP 云函数启动文件
package.json                    零依赖，start 指向 server.js
package-lock.json               npm lockfile
server.js                       HTTP 服务 + 知乎 API 调用
index.html / app.js / styles.css   前端页面
src/core.js                     评分与主题定义
src/history.js                  历史报告（浏览器 localStorage）
src/zhihu.js                    API 响应解析与来源绑定
test/core.test.js               15 项单元测试
docs/                           设计文档与静态图片资源
.github/workflows/ci.yml         CI 配置
```

以下内容已从交付副本中排除：`.git`、`node_modules`、Agent 会话子目录（`2026-09-13-b5b8de5b/`、`2026-09-13-25da8b41/`、`2026-09-14-f5f62ba9/`）。

---

## 10. 本地验证

部署前可在本地跑一遍：

```bash
npm test                    # 15 项测试
node --check server.js      # 语法检查

# 以部署等价参数启动
PORT=9000 HOST=0.0.0.0 ZHIHU_ACCESS_SECRET=<你的secret> node server.js
curl http://127.0.0.1:9000/healthz
```

未配置 `ZHIHU_ACCESS_SECRET` 时服务仍会启动，并在日志输出警告；此时业务接口返回 502，静态页面正常访问。

---

## 11. 安全检查清单

部署到生产前逐项确认：

- [ ] `.gitignore` 已排除 `.env`、`.env.*`（保留 `.env.example`）、`cloudbaserc.local.json`、`.cloudbase/`
- [ ] `cloudbaserc.local.json` 中没有任何凭证字段
- [ ] 源码中没有硬编码的 Access Secret（`grep -rn "ZHIHU_ACCESS_SECRET" .` 应只出现 `process.env` 读取）
- [ ] 前端代码（`app.js`）中不含任何密钥 —— 前端变量一律视作公开
- [ ] 运行时凭证全部来自控制台环境变量
- [ ] Access Secret 若曾意外提交或截图外泄，立即在知乎开放平台重置

---

## 12. 参考依据

本文档的平台事实来自以下 CloudBase 官方文档：

- [编写 HTTP 云函数](https://docs.cloudbase.net/cloud-function/develop/how-to-writing-functions-code)
- [启动文件说明](https://docs.cloudbase.net/cloud-function/develop/scf-bootstrap)
- [部署云函数 `tcb fn deploy`](https://docs.cloudbase.net/cli-v1/functions/deploy)
- [云函数配置文件](https://docs.cloudbase.net/cli-v1/functions/configs)
- [云函数 / 云托管的密钥与环境变量分层管理](https://docs.cloudbase.net/recipes/secure-secrets-in-cloud-function)
- [运行环境支持](https://docs.cloudbase.net/cloud-function/runtime-support)

知乎开放平台接口规格来自本机 `zhihu` Skill 的 HTTP API 参考文档（核验时间 2026-07-16）。
