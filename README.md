# 答主考官 Demo

一个按 [`docs/答主考官-Demo设计方案.md`](docs/答主考官-Demo设计方案.md) 实现的实时 MVP。核心闭环是：选题 → 先讲述 → 知乎搜索与知乎直答比对 → 补讲复测 → 掌握度报告与知识卡片。

## 本地运行

### 环境要求

- Node.js 20 或更高版本；
- 已安装并配置知乎官方 CLI；
- 知乎凭证只通过服务端环境变量或系统凭证库提供。

项目本身无需安装第三方 npm 依赖。开发时使用：

```bash
npm run dev
```

生产环境使用：

```bash
npm start
```

然后打开 `http://localhost:4173`。部署平台设置 `PORT` 后，服务会自动监听该端口。

后端会继承当前进程的知乎凭证环境变量，浏览器不会接触 Access Secret。CLI 路径按以下顺序解析：`ZHIHU_CLI_PATH`（绝对路径，最高优先级）→ `ZHIHU_SKILL_DIR/scripts/run.ps1 status`（或 skill 默认目录）的 `cli.binary_path` → `ZHIHU_CLI_HOME/current/zhihu-cli(.exe)` → PATH 中的 `zhihu-cli`。启动日志会打印实际使用的 CLI，未找到时会明确提示搜索与直答不可用。

可用的环境变量记录在 [`.env.example`](.env.example)。该文件仅是配置字段模板，项目不会自动读取本地 `.env`；请使用操作系统、进程管理器或部署平台的 Secret 功能注入变量。

搜索接口为 `POST /api/search`，请求体：`{"query":"你的问题"}`。从 0 掌握接口为 `POST /api/learn`，请求体：`{"topic":"问题"}`，调用知乎直答生成入门地图；评估接口为 `POST /api/evaluate`，请求体：`{"topic":"问题","answer":"用户讲述"}`；它调用知乎直答（默认 `zhida-thinking-1p5`）生成 5～8 个结构化考点，再由知乎搜索摘要绑定可追溯链接。知乎服务异常时返回 502，前端明确提示重试，不使用离线评估或 fixture 兜底。

知乎直答综合说明与知乎搜索摘要会在界面中分开标注；直答没有返回可验证链接时，不会伪造“查看原文”链接。

## 项目结构

```text
index.html                 静态入口
app.js                     前端状态机与页面渲染
styles.css                 页面样式与响应式布局
server.js                  Node 后端、知乎 CLI 发现与 API 路由
src/zhihu.js               搜索/直答响应标准化与来源绑定
src/core.js                主题、评分统计（fixture 仅供测试使用）
test/core.test.js          纯函数与响应标准化测试
docs/                      产品方案与宣传素材
```

当前项目保持无第三方依赖，适合 Demo 快速启动。`app.js` 和 `server.js` 暂时采用单文件结构，便于路演部署；如果继续增加历史报告、登录、缓存或更多知乎能力，再拆分为 `src/client/`、`src/server/` 和独立路由模块。

## 公网部署

当前后端通过知乎官方 CLI 调用知乎搜索和知乎直答。部署环境必须能够安装对应平台的 CLI，并配置 `ZHIHU_CLI_PATH` 与服务端凭证。若目标平台不支持安装额外二进制，需要先将这部分改为知乎开放平台 HTTP API 调用。

推荐把仓库连接到支持 Node.js 服务的部署平台，并配置：

- 构建命令：无需额外构建；
- 启动命令：`npm start`；
- 运行时：Node.js 20 或更高版本；
- Secret：按 `.env.example` 注入，不写入源码或部署日志。

## 安全说明

- 不要提交 Access Secret、OAuth Token、App Key 或本地 `.env`；
- 不要把服务端凭证放进浏览器代码、URL、截图或演示视频；
- 知乎内容摘要与直答综合说明在产品中明确区分，并保留可追溯来源；
- 对外部署后应继续配置 HTTPS、请求限流和日志脱敏。

## 测试

```bash
npm test
```

测试覆盖来源字段标准化、四类状态统计、评分和补讲提分逻辑。产品运行路径必须依赖实时知乎搜索与知乎直答；`src/core.js` 中保留的 fixture 仅供纯函数单元测试使用，不会被页面或 API 作为演示数据返回。
